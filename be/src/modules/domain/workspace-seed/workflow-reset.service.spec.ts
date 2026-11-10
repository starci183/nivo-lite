import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { GraphSeedService } from "./graph-seed.service"
import { WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
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

describe("WorkflowResetService: what it deletes", () => {
    it("reads the workspace by its name, then the agents of the chatbot, sales and accounting installations", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls.slice(0, 2)).toEqual([
            [WORKSPACE_SQL, ["NIVO"]],
            [AGENTS_SQL, ["ws-1", ["chatbot", "sales", "accounting"]]],
        ])
    })

    it("deletes the record links of the rows it clears first, before the rows they point at", async () => {
        const { subject, em } = await build()

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls[2]).toEqual([
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

        expect(em.query.mock.calls.slice(3)).toEqual([
            [STEPS_SQL, ["ws-1", "agent.run-step", "agent.run", AGENTS]],
            [RUNS_SQL, ["ws-1", "agent.run", AGENTS]],
            [WORKFLOWS_SQL, ["ws-1", CLEARED, AGENTS]],
            [LEADS_SQL, ["ws-1", ["agent.lead-memory", "agent.lead-freeze"]]],
            [GRAPHS_SQL, ["ws-1", "agent.graph", "agent.graph-version", AGENTS]],
            [FLOWS_SQL, ["ws-1", "agent.graph-version", AGENTS]],
        ])
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
        ])
    })

    it("leaves out an installation that has no agent yet", async () => {
        const { subject, em } = await build({ agents: [{ agent_id: null }, { agent_id: "agent-s" }] })

        await subject.run(TEXT, "NIVO")

        expect(em.query.mock.calls[3]?.[1]).toEqual(["ws-1", "agent.run-step", "agent.run", ["agent-s"]])
    })
})

describe("WorkflowResetService: the seed and the report", () => {
    it("runs the graph seed with the same text and workspace once everything is deleted", async () => {
        const { subject, em, seed } = await build()
        seed.run.mockImplementation(() => {
            expect(em.query).toHaveBeenCalledTimes(9)
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
