import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { AgentGraphsErrorCode } from "@modules/domain/agent-graphs/errors/agent-graphs.error"
import { GRAPH_TEMPLATE_EDITED, requireSoundFlow, sameFlow, templateFlowProblems } from "@modules/domain/agent-graphs/policies/flow.policy"
import { graphWithNodeMode } from "@modules/domain/agent-graphs/policies/node-mode-override.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { DESK_AGENT, DESK_FRONT } from "@tests/fixtures/builders/thread-desk-plugin.builder"
import { ANSWER, CONTACT, CONV, UNDERSTAND, ZALO, itemsOf, processOf, refOf, startThread, stopsOf, threadDbOf, type ThreadDb } from "./thread-world"

// The world's desk installed beside the core: its front desk is an INSTALLED template graph (`thread-desk-plugin.builder.ts`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const desk: typeof import("@tests/fixtures/builders/thread-desk-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/thread-desk-plugin.builder",
    )
    return { installed: parts.installationWith([desk.DESK_PLUGIN], "world-desk") }
})

// E-FIX8 (F-R5-1, RESTART-R5 smoke): `setAgentNodeMode` refused EVERY real mode change on an adopted package graph with
// `GRAPH_V2_EDITED`, because the save judged a template flow only when it equalled an installed template graph content for content, its
// steps' modes included. GENERAL RULE (engine words): a node step's ONE mode is the shop's setting on its own copy of a template graph
// (nivo-frame `rights` rule 5); a stored flow that differs from an installed template graph ONLY in the modes of its node steps is still
// that graph's copy, judged with the copy's modes; any other difference is an edit (`GRAPH_TEMPLATE_EDITED`). This world is the exposing
// case's kind (a step that sends a line to the person of the route, the front desk's `answer`); `node-mode-setting-write.spec.ts` proves
// the same rule on a different kind of workflow (a plain record write with no person).
// Real: the save judgement (`requireSoundFlow`, the one the workflow store runs on every publish), the door's pure change of one mode
// (`graphWithNodeMode`, what the owner door writes), the thread engine, the tool door judging the mode of the PINNED version, the approvals.

const INDEX = nodeIndexOf(INSTALLED.nodeInstall())

/** What the owner door treats as an engine control step (the admin service's own test). */
const isControl = (step: string): boolean => INSTALLED.stepOf(step)?.control === true

/** The front desk as the install reads it: what an adopted workflow stores as its first version. */
const adopted = (): GraphSpec => {
    const graph = INSTALLED.templateOf(DESK_FRONT)?.versions[0]?.graph
    if (graph === undefined) throw new Error(`no template ${DESK_FRONT}`)
    return graph
}

/** The owner door's change, then the store's round trip (the stored document is JSON). */
const set = (graph: GraphSpec, mode: "auto" | "ask"): GraphSpec => {
    const changed = graphWithNodeMode(graph, "answer", mode, isControl)
    if (changed === null) throw new Error("the mode did not change")
    const stored: GraphSpec = JSON.parse(JSON.stringify(changed))
    return stored
}

const TEXT = "Shop mo cua tu 8h den 21h a."
const TRIGGER = {
    eventId: "zalo:m-mode-1",
    routeId: CONV,
    contactId: CONTACT,
    accountId: ZALO,
    subject: { channel: "zalo", id: "zalo-user-1" },
    data: { text: "Shop mo cua may gio?", messageKey: "zalo:m-mode-1" },
    locale: "vi",
}

/** One run of the front desk pinned to `flow` as version `number` of the adopted workflow: the question goes to the answer step, which sends. */
const runOn = async (db: ThreadDb, flow: GraphSpec, number: number) => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "gio mo cua" } })
    db.model.script(ANSWER, { call: { tool: TOOL.customerMessageSend, args: { text: TEXT } } }, { done: { reply: TEXT } })
    const process = await processOf(db)
    const started = await startThread(process, { flow, versionId: `${DESK_AGENT}:front-desk@${number}`, workflowId: "wf:front-desk", trigger: TRIGGER })
    expect(started.error).toBeNull()
    return { process, runId: started.runId ?? "" }
}

describe("a node's mode is the shop's setting on its copy of an installed template graph", () => {
    it("the adopted graph with one node set to ask saves (no edit), and set back it is the template's own graph again", () => {
        const asking = set(adopted(), "ask")

        expect(templateFlowProblems(asking)).toEqual([])
        expect(() => requireSoundFlow(asking, INDEX)).not.toThrow()
        expect(asking.nodes.find((node) => node.key === "answer")?.mode).toBe("ask")

        const back = set(asking, "auto")
        expect(sameFlow(adopted(), back)).toBe(true)
        expect(templateFlowProblems(back)).toEqual([])
    })

    it("any other difference is still an edit: a step's params, or a mode on a control step the template gives none", () => {
        const flow = adopted()
        const params: GraphSpec = {
            ...flow,
            nodes: flow.nodes.map((node) => (node.key === "answer" ? { ...node, mode: "ask", params: { ...node.params, text: "x" } } : node)),
        }
        const control: GraphSpec = {
            ...flow,
            nodes: flow.nodes.map((node) => (node.key === "to-consult" ? { ...node, mode: "ask" } : node)),
        }

        expect(templateFlowProblems(params)).toEqual([{ code: GRAPH_TEMPLATE_EDITED, at: DESK_AGENT }])
        expect(templateFlowProblems(control)).toEqual([{ code: GRAPH_TEMPLATE_EDITED, at: DESK_AGENT }])
        expect(() => requireSoundFlow(params, INDEX)).toThrow(expect.objectContaining({ code: AgentGraphsErrorCode.PublishRefused }))
    })

    it("a run pinned to the version with `ask` stops at the send for a person's yes; nothing is said yet", async () => {
        const db = threadDbOf()
        const { process, runId } = await runOn(db, set(adopted(), "ask"), 2)

        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["answer", "approval", "open"]])
        expect(itemsOf(db)).toHaveLength(1)
        const [stop] = await stopsOf(process, runId)
        expect(JSON.stringify(stop?.detail.approvalCard)).toContain(TEXT)
        expect(db.lines).toEqual([])
    })

    it("a run pinned to the version set back to auto sends with no stop", async () => {
        const db = threadDbOf()
        const { process, runId } = await runOn(db, set(set(adopted(), "ask"), "auto"), 3)

        expect(await stopsOf(process, runId)).toEqual([])
        expect(itemsOf(db)).toEqual([])
        expect(db.lines.map((line) => line.text)).toEqual([TEXT])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })
})
