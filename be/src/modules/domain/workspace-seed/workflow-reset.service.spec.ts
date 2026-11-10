import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { GraphSeedService } from "./graph-seed.service"
import { WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import { RESET_RUN_STATE } from "./workflow-reset.policy"
import { WorkflowResetService } from "./workflow-reset.service"

const SPEC = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}
const TEXT = `${JSON.stringify({ documents: [{ path: "data/graphs/sales.json", document: SPEC }] })}\n`

/** The statements the reset sends, word for word: the stub of the entity manager double is keyed by the text. */
const WORKSPACE_SQL = "SELECT id::text AS id FROM public.workspaces WHERE name = $1"
const AGENTS_SQL = `SELECT agent_id::text AS agent_id FROM public.module_installations
              WHERE workspace_id = $1 AND module_key = ANY($2) AND removed_at IS NULL`
const LINKS_SQL = `DELETE FROM public.record_links l USING public.records r
              WHERE l.workspace_id = $1 AND r.workspace_id = $1
                AND ((l.from_entity = r.entity AND l.from_id = r.id) OR (l.to_entity = r.entity AND l.to_id = r.id))
                AND ((r.entity = ANY($2) AND r.data->>'agentId' = ANY($3))
                  OR (r.entity = $4 AND r.data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $5 AND data->>'agentId' = ANY($3)))
                  OR r.entity = ANY($6)
                  OR (r.entity = $7 AND r.data->>'agentId' = ANY($3) AND jsonb_exists(r.data->'document', 'flow')))`
const RUN_IDS_SQL =
    "SELECT id::text AS id FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)"
const TABLE_SQL = "SELECT to_regclass($1) IS NOT NULL AS present"
const STEPS_SQL = `DELETE FROM public.records WHERE workspace_id = $1 AND entity = $2
               AND data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $3 AND data->>'agentId' = ANY($4))`
const RUNS_SQL = "DELETE FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)"
const WORKFLOWS_SQL =
    "DELETE FROM public.records WHERE workspace_id = $1 AND entity = ANY($2) AND data->>'agentId' = ANY($3)"
const LEADS_SQL = "DELETE FROM public.records WHERE workspace_id = $1 AND entity = ANY($2)"
const GRAPHS_SQL = `UPDATE public.records g
                SET data = jsonb_set(g.data, '{activeVersionId}', COALESCE((
                        SELECT to_jsonb(v.id::text) FROM public.records v
                         WHERE v.workspace_id = $1 AND v.entity = $3 AND v.data->>'agentId' = g.data->>'agentId'
                           AND NOT jsonb_exists(v.data->'document', 'flow')
                         ORDER BY (v.data->>'number')::int DESC LIMIT 1), 'null'::jsonb)),
                    version = g.version + 1
              WHERE g.workspace_id = $1 AND g.entity = $2 AND g.data->>'agentId' = ANY($4)`
const FLOWS_SQL = `DELETE FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)
               AND jsonb_exists(data->'document', 'flow')`

/** The dry run's counts of the record kinds, in the order it sends them (links, steps, workflows, lead rows, flow versions). */
const COUNTS = [
    `SELECT count(*)::int AS count FROM public.record_links l
              WHERE l.workspace_id = $1 AND EXISTS (SELECT 1 FROM public.records r
                WHERE r.workspace_id = $1
                  AND ((l.from_entity = r.entity AND l.from_id = r.id) OR (l.to_entity = r.entity AND l.to_id = r.id))
                  AND ((r.entity = ANY($2) AND r.data->>'agentId' = ANY($3))
                    OR (r.entity = $4 AND r.data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $5 AND data->>'agentId' = ANY($3)))
                    OR r.entity = ANY($6)
                    OR (r.entity = $7 AND r.data->>'agentId' = ANY($3) AND jsonb_exists(r.data->'document', 'flow'))))`,
    `SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = $2
               AND data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $3 AND data->>'agentId' = ANY($4))`,
    "SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = ANY($2) AND data->>'agentId' = ANY($3)",
    "SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = ANY($2)",
    `SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)
               AND jsonb_exists(data->'document', 'flow')`,
]

/** The run-state kinds' clears, in order. */
const STATE_CLEARS = RESET_RUN_STATE.map((kind) => kind.clear)

/** The entities the reset clears by agent: the workflows, their versions, the run pins and the conversation holds. */
const CLEARED = ["agent.workflow", "agent.workflow-version", "agent.run-workflow", "agent.conversation-hold"]

/** What a DELETE answers on Postgres through typeorm: the returned rows, then how many were removed. */
const removed = (count: number): readonly [ReadonlyArray<unknown>, number] => [[], count]

/** A result that fails when the reset awaits it, as a lost connection does. */
const lost = { then: (_resolve: unknown, reject: (cause: unknown) => void) => reject(unreachable()) }

function unreachable(): WorkspaceSeedError {
    return new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.ConnectorUnreachable })
}

interface Answers {
    /** The rows the workspace lookup answers. */
    readonly workspaces?: ReadonlyArray<{ id: string }>
    /** The installations' agents the transaction reads. */
    readonly agents?: ReadonlyArray<{ agent_id: string | null }>
    /** What the workflow DELETE answers. */
    readonly workflows?: unknown
    /** What the runs DELETE answers. */
    readonly runs?: unknown
    /** Whether the lesson candidates' table exists. */
    readonly lessons?: boolean
}

const build = async (answers: Answers = {}) => {
    const em = mockEntityManager({
        query: [
            [WORKSPACE_SQL, answers.workspaces ?? [{ id: "ws-1" }]],
            [AGENTS_SQL, answers.agents ?? [{ agent_id: "agent-c" }, { agent_id: "agent-s" }]],
            [LINKS_SQL, removed(9)],
            [STEPS_SQL, removed(11)],
            [RUNS_SQL, answers.runs ?? removed(5)],
            [WORKFLOWS_SQL, answers.workflows ?? removed(7)],
            [LEADS_SQL, removed(3)],
            [GRAPHS_SQL, removed(2)],
            [FLOWS_SQL, removed(4)],
            [RUN_IDS_SQL, [{ id: "run-1" }, { id: "run-2" }]],
            [TABLE_SQL, [{ present: answers.lessons ?? true }]],
            ...RESET_RUN_STATE.map((kind, index): [string, unknown] => [kind.clear, removed(index + 1)]),
            ...RESET_RUN_STATE.map((kind, index): [string, unknown] => [kind.count, [{ count: 10 + index }]]),
            ...COUNTS.map((sql, index): [string, unknown] => [sql, [{ count: 20 + index }]]),
        ],
    })
    const transaction = fakeTransaction(em)
    const seed = mock<GraphSeedService>()
    seed.run.mockResolvedValue(undefined)
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkflowResetService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: GraphSeedService, useValue: seed },
            { provide: WORKSPACE_SEED_OPTIONS, useValue: { print } },
        ],
    }).compile()
    return { subject: moduleRef.get(WorkflowResetService), em, transaction, seed, print }
}

const AGENTS = ["agent-c", "agent-s"]
const RUNS = ["run-1", "run-2"]

describe("WorkflowResetService: what it deletes", () => {
    it("reads the workspace by its name, the agents of the chatbot, sales and accounting installations, then their runs", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls.slice(0, 3)).toEqual([
            [WORKSPACE_SQL, ["NIVO"]],
            [AGENTS_SQL, ["ws-1", ["chatbot", "sales", "accounting"]]],
            [RUN_IDS_SQL, ["ws-1", "agent.run", AGENTS]],
        ])
    })

    it("deletes the record links of the rows it clears first, before the rows they point at", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls[3]).toEqual([
            LINKS_SQL,
            [
                "ws-1",
                ["agent.run", ...CLEARED],
                AGENTS,
                "agent.run-step",
                "agent.run",
                ["agent.lead-memory", "agent.lead-freeze"],
                "agent.graph-version",
            ],
        ])
    })

    it("deletes the steps of the agents' runs, the runs, the workflows with their versions, pins and holds, the lead rows, then the graph versions that held a flow", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls.slice(4, 10)).toEqual([
            [STEPS_SQL, ["ws-1", "agent.run-step", "agent.run", AGENTS]],
            [RUNS_SQL, ["ws-1", "agent.run", AGENTS]],
            [WORKFLOWS_SQL, ["ws-1", CLEARED, AGENTS]],
            [LEADS_SQL, ["ws-1", ["agent.lead-memory", "agent.lead-freeze"]]],
            [GRAPHS_SQL, ["ws-1", "agent.graph", "agent.graph-version", AGENTS]],
            [FLOWS_SQL, ["ws-1", "agent.graph-version", AGENTS]],
        ])
    })

    it("then clears the run state of every gone run, each kind keyed by the deleted runs and the run entity", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO")

        const calls = em.query.mock.calls.slice(10)
        expect(calls[0]).toEqual([TABLE_SQL, ["public.brain_lesson_candidates"]])
        expect(calls.slice(1).map((call) => call[0])).toEqual(STATE_CLEARS)
        expect(calls.slice(1).map((call) => call[1])).toEqual([
            ["ws-1", RUNS, "agent.run", "agent.run-stop"],
            ["ws-1", RUNS, "agent.run", "agent.run-stop"],
            ["ws-1", RUNS, "agent.run"],
            ["ws-1", RUNS, "agent.run"],
            ["ws-1", RUNS, "agent.run"],
            ["ws-1", RUNS, "agent.run", ["agent_step", "thread_deadline"], ["queued", "running"]],
            ["ws-1", RUNS, "agent.run", "thread", ["pending", "held", "running", "failed"], "workflow_reset"],
            ["ws-1", RUNS, "agent.run", ["queued", "waiting_decision"], "lead_frozen", "workflow_reset"],
            ["ws-1", AGENTS, ["open", "waiting"]],
            ["ws-1", RUNS, "agent.run", ["candidate", "proposing"]],
        ])
    })

    it("names in every statement exactly the values it uses ($1..$n, none left over)", () => {
        for (const kind of RESET_RUN_STATE) {
            const used = (sql: string) => Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])))
            const base = kind.key === "runs" ? 3 : 2
            expect(used(kind.count)).toBe(base + kind.extra.length)
            expect(used(kind.clear)).toBe(base + kind.extra.length + (kind.setExtra?.length ?? 0))
        }
    })

    it("keys a run's state by a gone run only when it names one: a null name is never gone", () => {
        for (const kind of RESET_RUN_STATE.filter((one) => one.key === "runs")) {
            expect(kind.count).toContain("IS NOT NULL AND (")
            expect(kind.count).toContain("NOT EXISTS (SELECT 1 FROM public.records run WHERE run.workspace_id = $1 AND run.entity = $3")
        }
    })

    it("sends no statement to the lesson candidates' table before its migration made it", async () => {
        const { subject, em, print } = await build({ lessons: false })

        await subject.run(TEXT, "NIVO")

        const lessons = RESET_RUN_STATE.find((kind) => kind.optional === true)
        expect(em.query.mock.calls.map((call) => call[0])).not.toContain(lessons?.clear)
        expect(print.mock.calls.map((call) => call[0])).toContain("reset open lesson candidates of gone runs (declined): 0 removed")
    })

    it("does it all in one transaction that commits", async () => {
        const { subject, transaction } = await build()

        await subject.run(TEXT, "NIVO")

        expect(transaction.outcomes).toEqual(["commit"])
        expect(transaction.committedWrites.map((write) => write.args[0])).toEqual([
            LINKS_SQL,
            STEPS_SQL,
            RUNS_SQL,
            WORKFLOWS_SQL,
            LEADS_SQL,
            GRAPHS_SQL,
            FLOWS_SQL,
            ...STATE_CLEARS,
        ])
    })

    it("leaves out an installation that has no agent yet", async () => {
        const { subject, em } = await build({ agents: [{ agent_id: null }, { agent_id: "agent-s" }] })

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls[4]?.[1]).toEqual(["ws-1", "agent.run-step", "agent.run", ["agent-s"]])
    })
})

describe("WorkflowResetService: the seed and the report", () => {
    it("runs the graph seed with the same text and workspace once everything is deleted", async () => {
        const { subject, em, seed } = await build()
        seed.run.mockImplementation(() => {
            expect(em.query).toHaveBeenCalledTimes(11 + RESET_RUN_STATE.length)
            return Promise.resolve()
        })

        await subject.run(TEXT, "NIVO")

        expect(seed.run.mock.calls).toEqual([[TEXT, "NIVO"]])
    })

    it("prints how many it removed of each kind, and never a value", async () => {
        const { subject, print } = await build()

        await subject.run(TEXT, "NIVO")

        expect(print.mock.calls.map((call) => call[0])).toEqual([
            "reset agents: 2 removed",
            "reset record links: 9 removed",
            "reset run steps: 11 removed",
            "reset runs: 5 removed",
            "reset workflows, versions, run pins and conversation holds: 7 removed",
            "reset graph versions that held a flow: 4 removed",
            "reset lead memory and freezes: 3 removed",
            "reset run stop links: 1 removed",
            "reset run stops: 2 removed",
            "reset LangGraph checkpoint writes: 3 removed",
            "reset LangGraph checkpoint values: 4 removed",
            "reset LangGraph checkpoints: 5 removed",
            "reset open step and deadline jobs: 6 removed",
            "reset open thread wakes (closed dead): 7 removed",
            "reset open work items of gone runs and lead freezes (closed rejected): 8 removed",
            "reset open care timers of the reset agents (dropped): 9 removed",
            "reset open lesson candidates of gone runs (declined): 10 removed",
        ])
    })

    it("counts nothing for a statement that answers no count", async () => {
        const { subject, print } = await build({ runs: { affected: 4 } })

        await subject.run(TEXT, "NIVO")

        expect(print.mock.calls.map((call) => call[0])).toContain("reset runs: 0 removed")
    })

    it("is idempotent: a second run sends the same statements and seeds again", async () => {
        const { subject, em, seed } = await build()

        await subject.run(TEXT, "NIVO")
        const first = em.query.mock.calls.map((call) => [...call])
        em.query.mockClear()
        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls.map((call) => [...call])).toEqual(first)
        expect(seed.run).toHaveBeenCalledTimes(2)
    })
})

describe("WorkflowResetService: the dry run", () => {
    it("counts every kind with the same conditions, prints the counts, and changes nothing: no transaction, no seed", async () => {
        const { subject, em, transaction, seed, print } = await build()

        await subject.run(TEXT, "NIVO", { dryRun: true })

        expect(transaction.outcomes).toEqual([])
        expect(seed.run).not.toHaveBeenCalled()
        const sent = em.query.mock.calls.map((call) => String(call[0]))
        expect(sent.filter((sql) => /^\s*(DELETE|UPDATE)/.test(sql))).toEqual([])
        expect(sent).toEqual(expect.arrayContaining(RESET_RUN_STATE.map((kind) => kind.count)))
        expect(print.mock.calls.map((call) => call[0])).toEqual([
            "reset (dry run) agents: 2 to remove",
            "reset (dry run) record links: 20 to remove",
            "reset (dry run) run steps: 21 to remove",
            "reset (dry run) runs: 2 to remove",
            "reset (dry run) workflows, versions, run pins and conversation holds (the seed writes these again): 22 to remove",
            "reset (dry run) graph versions that held a flow (the seed writes these again): 24 to remove",
            "reset (dry run) lead memory and freezes: 23 to remove",
            ...RESET_RUN_STATE.map((kind, index) => `reset (dry run) ${kind.what}: ${String(10 + index)} to remove`),
        ])
    })

    it("counts a kind with exactly the values its clear filters by (the SET's own values left out)", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO", { dryRun: true })

        const wakes = RESET_RUN_STATE.find((kind) => kind.what.startsWith("open thread wakes"))
        const call = em.query.mock.calls.find((one) => one[0] === wakes?.count)
        expect(call?.[1]).toEqual(["ws-1", RUNS, "agent.run", "thread", ["pending", "held", "running", "failed"]])
    })
})

describe("WorkflowResetService: what it refuses", () => {
    it("refuses text that is no graph envelope before it reads or deletes anything", async () => {
        const { subject, em, seed } = await build()

        await expect(subject.run("not json", "NIVO")).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.InputInvalid,
        })

        expect(em.query).not.toHaveBeenCalled()
        expect(seed.run).not.toHaveBeenCalled()
    })

    it("refuses a name that matches no workspace, deleting nothing", async () => {
        const { subject, em, seed } = await build({ workspaces: [] })

        await expect(subject.run(TEXT, "NIVO")).rejects.toThrow('workspace "NIVO" is not exactly one workspace')

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(seed.run).not.toHaveBeenCalled()
    })

    it("refuses a name that matches two workspaces, deleting nothing", async () => {
        const { subject, em, seed } = await build({ workspaces: [{ id: "ws-1" }, { id: "ws-2" }] })

        await expect(subject.run(TEXT, "NIVO")).rejects.toThrow('workspace "NIVO" is not exactly one workspace')

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(seed.run).not.toHaveBeenCalled()
    })

    it("rolls back, seeds nothing and prints nothing when a delete fails", async () => {
        const { subject, transaction, seed, print } = await build({ workflows: lost })

        await expect(subject.run(TEXT, "NIVO")).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.ConnectorUnreachable,
        })

        expect(transaction.outcomes).toEqual(["rollback"])
        expect(seed.run).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("lets the seed's refusal through after the clear has committed", async () => {
        const { subject, transaction, seed } = await build()
        seed.run.mockRejectedValue(unreachable())

        await expect(subject.run(TEXT, "NIVO")).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.ConnectorUnreachable,
        })

        expect(transaction.outcomes).toEqual(["commit"])
    })
})
