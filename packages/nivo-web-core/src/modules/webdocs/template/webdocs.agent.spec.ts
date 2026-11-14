import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    type TemplateTriggerLookup,
    templateAgentProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { CRM_NIVOWEB_PROVIDER } from "../../../crm/nivoweb/api.generated"
import { webdocsDraftGraph } from "./draft.graph"
import { webdocsTeamChatGraph } from "./team-chat.graph"
import { webdocsAgent } from "./webdocs.agent"

/** The engine's trigger lookup as this spec assumes it: both graphs are reached by a call only. */
const triggers: TemplateTriggerLookup = {
    supplies: (verb) => (verb === TRIGGER.workflowCalled ? { kind: "caller" } : { kind: "unknown" }),
}

/** A graph's steps by key, each with its kind and, for a node step, its node id. */
const stepsOf = (graph: TemplateGraph): ReadonlyArray<readonly [string, string]> =>
    graph.spec.nodes.map((step) => [step.key, step.kind === "node" ? step.step : step.kind] as const)

/** One step of a graph by key. */
const stepOf = (graph: TemplateGraph, key: string): (typeof graph.spec.nodes)[number] | undefined =>
    graph.spec.nodes.find((step) => step.key === key)

/** `expect.objectContaining` as the `unknown` a matcher slot takes. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

describe("the Paperwork agent template", () => {
    it("loads with no problem, its graphs judged strictly (nullability) with its providers and the supplies of its triggers", () => {
        expect(templateAgentProblems(webdocsAgent, { triggers })).toEqual([])
        for (const graph of webdocsAgent.graphs) {
            expect(
                templateGraphProblems(graph.spec, {
                    nodes: graph.nodes,
                    agentAccounts: webdocsAgent.accounts,
                    triggers,
                    nullability: "strict",
                }),
            ).toEqual([])
        }
    })

    it("attaches the CRM only; the draft is primary", () => {
        expect(webdocsAgent.key).toBe("webdocs")
        expect(webdocsAgent.accounts).toEqual([CRM_NIVOWEB_PROVIDER])
        expect(webdocsAgent.graphs.map((graph) => graph.key)).toEqual(["webdocs.draft", "webdocs.team-chat"])
        expect(webdocsAgent.primary).toBe("webdocs.draft")
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(webdocsAgent.graphs.map((graph) => [graph.key, graph.spec.catalogue?.version])).toEqual([
            ["webdocs.draft", 8],
            ["webdocs.team-chat", 8],
        ])
    })

    it("reads the CRM only (the read step acts through the CRM alone, auto)", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`: one mode per node, no per-operation modes): "every CRM operation auto" is read as
        // the step's one mode; "none a write" is the node's reads list (`webdocs.read` calls only CRM reads), pinned by its own spec.
        for (const graph of webdocsAgent.graphs) {
            const read = stepOf(graph, "read")
            expect(read?.kind === "node" ? { mode: read.mode, accounts: read.accounts } : null).toEqual({
                mode: "auto",
                accounts: [CRM_NIVOWEB_PROVIDER],
            })
        }
    })
})

describe("webdocs.draft", () => {
    it("is called by any workflow, then reads, drafts, hands the draft to the team and ends drafted", () => {
        expect(webdocsDraftGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(webdocsDraftGraph.spec.entry.openTo).toBe("any")
        expect(stepsOf(webdocsDraftGraph)).toEqual(
            expect.arrayContaining([
                ["read", "webdocs.read"],
                ["draft", "webdocs.draft"],
                ["post", "webdocs.draft-post"],
                ["post-declined", "if"],
                ["drafted", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        expect(webdocsDraftGraph.spec.nodes).toHaveLength(6)
        const post = stepOf(webdocsDraftGraph, "post")
        expect(post?.kind === "node" ? post.step : null).toBe("webdocs.draft-post")
        expect(webdocsDraftGraph.nodes.get("webdocs.draft-post")?.tools).toEqual([TOOL.teamMessagePost])
    })

    it("a declined post ends declined with no notice (the declined write is itself a team post)", () => {
        const post = stepOf(webdocsDraftGraph, "post")
        expect(post?.kind === "node" ? post.next : undefined).toBe("post-declined")
        const check = stepOf(webdocsDraftGraph, "post-declined")
        expect(check?.kind).toBe("if")
        if (check?.kind !== "if") return
        expect(check.params.when).toEqual({
            op: "eq",
            ref: objectLike({ $ref: "steps.post.output.declined" }),
            value: true,
        })
        expect(check.routes.yes).toBe("declined")
        expect(check.routes.no).toBe("drafted")
        const end = stepOf(webdocsDraftGraph, "declined")
        expect(end?.kind === "outcome" ? end.params.outcome : undefined).toBe("declined")
    })
})

describe("webdocs.team-chat", () => {
    it("reads, drafts and answers in the room of the person's message", () => {
        expect(webdocsTeamChatGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(stepsOf(webdocsTeamChatGraph)).toEqual(
            expect.arrayContaining([
                ["read", "webdocs.read"],
                ["draft", "webdocs.draft"],
                ["post", "team.answer-post"],
                ["post-declined", "if"],
                ["drafted", "outcome"],
                ["declined", "outcome"],
            ]),
        )
        expect(webdocsTeamChatGraph.spec.nodes).toHaveLength(6)
        expect(webdocsTeamChatGraph.spec.catalogue?.version).toBe(8)
        const declined = stepOf(webdocsTeamChatGraph, "post-declined")
        expect(declined).toMatchObject({ routes: { yes: "declined", no: "drafted" } })
        const post = stepOf(webdocsTeamChatGraph, "post")
        expect(post?.kind === "node" ? post.params["messageId"] : null).toEqual({ $ref: "trigger.data.messageId" })
    })
})

describe("the webdocs catalogues' seedActive", () => {
    it("mirrors the old JSON template of every graph: active at seed exactly where the JSON said `seedActive: true`", () => {
        const seeded = webdocsAgent.graphs.map(
            (graph) => [graph.key, graph.spec.catalogue?.seedActive === true] as const,
        )
        expect([...seeded].sort(([a], [b]) => a.localeCompare(b))).toEqual([
            ["webdocs.draft", false],
            ["webdocs.team-chat", true],
        ])
    })
})
