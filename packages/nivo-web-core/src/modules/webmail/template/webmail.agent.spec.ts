import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { webmailTeamChatGraph } from "./team-chat.graph"
import { webmailTriageGraph } from "./triage.graph"
import { webmailAgent } from "./webmail.agent"

/** The engine's trigger lookup as this spec assumes it (ruling B5): the clock its preset, a mail its ids and count, a call what it maps. */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => {
        if (verb === TRIGGER.workflowCalled) return { kind: "caller" }
        if (verb === TRIGGER.clockTick) return { kind: "fixed", params: [{ name: "preset", type: "string" }] }
        if (verb === TRIGGER.mailMessageReceived) {
            return {
                kind: "fixed",
                params: [
                    { name: "eventIds", type: "array" },
                    { name: "count", type: "number" },
                ],
            }
        }
        return { kind: "unknown" }
    },
}

/** A graph's steps by key, each with its kind and, for a node step, its node id. */
const stepsOf = (graph: TemplateGraph): ReadonlyArray<readonly [string, string]> =>
    graph.spec.nodes.map((step) => [step.key, step.kind === "node" ? step.step : step.kind] as const)

/** One step of a graph by key. */
const stepOf = (graph: TemplateGraph, key: string): (typeof graph.spec.nodes)[number] | undefined =>
    graph.spec.nodes.find((step) => step.key === key)

/** `expect.objectContaining` as the `unknown` a matcher slot takes. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

describe("the Mailbox agent template", () => {
    it("loads with no problem, its graphs judged with its providers and the supplies of its triggers", () => {
        expect(templateAgentProblems(webmailAgent, { triggers })).toEqual([])
        for (const graph of webmailAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: webmailAgent.accounts,
                    triggers,
                    nullability: "strict",
                }),
            ).toEqual([])
        }
    })

    it("attaches the mailbox only; the triage is primary", () => {
        expect(webmailAgent.key).toBe("webmail")
        expect(webmailAgent.accounts).toEqual([PROVIDER.imap])
        expect(webmailAgent.graphs.map((graph) => graph.key)).toEqual(["webmail.triage", "webmail.team-chat"])
        expect(webmailAgent.primary).toBe("webmail.triage")
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        // 2026-11-14 (R68): the triage + 1, its conditions, loop and outcomes carry the workspace's words (labels; business unchanged).
        expect(webmailTriageGraph.spec.catalogue?.version).toBe(7)
        // 2026-11-14 (EF-G, `rights` 11c): the chat turn + 1 (a declined answer post ends the turn `declined`).
        expect(webmailTeamChatGraph.spec.catalogue?.version).toBe(5)
    })
})

describe("webmail.triage", () => {
    it("wakes every 15 minutes and on a new mail of the mailbox, open to the agent only", () => {
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12: one source per STREAM): `account: x` -> `accounts: [x]`; the
        // provider listed once means EVERY attached mailbox is a source (cto@, ketoan@, support@: three streams, three sources).
        expect(webmailTriageGraph.spec.triggers).toEqual([
            { verb: TRIGGER.clockTick, args: { preset: "every_15m" } },
            { verb: TRIGGER.mailMessageReceived, accounts: [PROVIDER.imap] },
        ])
        expect(webmailTriageGraph.spec.entry.openTo).toBe("agent")
    })

    it("reads, sorts each mail in a loop keyed by the mail, reports, hands the four lists on, and ends sorted or empty", () => {
        expect(stepsOf(webmailTriageGraph)).toEqual(
            expect.arrayContaining([
                ["read", "webmail.read"],
                ["has-mail", "if"],
                ["each", "loop"],
                ["sort", "webmail.sort"],
                ["report", "webmail.sorted-report"],
                ["report-declined", "if"],
                ["hand-offs", "if"],
                ["hand-offs-call-1", "call-workflow"],
                ["hand-offs-when-2", "if"],
                ["hand-offs-call-2", "call-workflow"],
                ["hand-offs-when-3", "if"],
                ["hand-offs-call-3", "call-workflow"],
                ["hand-offs-when-4", "if"],
                ["hand-offs-call-4", "call-workflow"],
                ["sorted", "outcome"],
                ["empty", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        expect(webmailTriageGraph.spec.nodes).toHaveLength(17)
        const loop = stepOf(webmailTriageGraph, "each")
        expect(
            loop?.kind === "loop" && loop.params.mode === "over"
                ? [loop.params.itemKey, loop.params.collect, loop.params.max, loop.params.concurrency]
                : null,
        ).toEqual(["id", "sort", 25, 1])
        expect(webmailTriageGraph.spec.outcomes.map((outcome) => outcome.key).sort()).toEqual(["declined", "empty", "sorted"])
    })

    it("a declined round report ends declined with no notice and no hand-off (the declined write is itself a team post)", () => {
        const report = stepOf(webmailTriageGraph, "report")
        expect(report?.kind === "node" ? report.next : undefined).toBe("report-declined")
        const check = stepOf(webmailTriageGraph, "report-declined")
        expect(check?.kind).toBe("if")
        if (check?.kind !== "if") return
        expect(check.params.when).toEqual({
            op: "eq",
            ref: objectLike({ $ref: "steps.report.output.declined" }),
            value: true,
        })
        expect(check.routes.yes).toBe("declined")
        expect(check.routes.no).toBe("hand-offs")
    })

    it("hands each list to the agent that handles it, a call made only when its list holds a mail", () => {
        const checks = ["hand-offs", "hand-offs-when-2", "hand-offs-when-3", "hand-offs-when-4"].map((key) => {
            const check = stepOf(webmailTriageGraph, key)
            return check?.kind === "if" ? check.params.when : null
        })
        const calls = [1, 2, 3, 4].map((index) => {
            const call = stepOf(webmailTriageGraph, `hand-offs-call-${index}`)
            return call?.kind === "call-workflow" ? [call.params.agent, call.params.workflow] : null
        })
        expect(checks).toEqual(
            ["renewals", "tickets", "invoices", "enquiries"].map((list) => ({
                ref: { $ref: `steps.report.output.${list}`, default: null },
                op: "present",
            })),
        )
        expect(calls).toEqual([
            ["webrenew", "mail-replies"],
            ["webdesk", "mail-tickets"],
            ["webbooks", "supplier-invoices"],
            ["websales", "mail-enquiries"],
        ])
    })
})

describe("webmail.team-chat", () => {
    it("is the shared chat turn with blocks-core's own answer turn", () => {
        expect(webmailTeamChatGraph.key).toBe("webmail.team-chat")
        expect(webmailTeamChatGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(stepsOf(webmailTeamChatGraph)).toEqual(
            expect.arrayContaining([
                ["answer", "team.chat"],
                ["has-proposal", "if"],
                ["propose", "team.truth-propose"],
                ["post", "team.answer-post"],
                ["post-declined", "if"],
                ["declined", "outcome"],
            ]),
        )
    })
})

describe("the webmail catalogues' seedActive", () => {
    it("mirrors the old JSON template of every graph: active at seed exactly where the JSON said `seedActive: true`", () => {
        const seeded = webmailAgent.graphs.map(
            (graph) => [graph.key, graph.spec.catalogue?.seedActive === true] as const,
        )
        expect([...seeded].sort(([a], [b]) => a.localeCompare(b))).toEqual([
            ["webmail.team-chat", true],
            ["webmail.triage", false],
        ])
    })
})
