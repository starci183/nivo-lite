import { CALL_WORKFLOW_STEP, WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { messageOf } from "../../messages/catalog"
import { coreEffects } from "../../vocabulary/effects"
import { CALLER_MEMBER, callPayloadOf, coreCallWorkflowNode } from "./call-workflow.node"

const TARGET = { agent: "sales", workflow: "consult", version: "latest" as const }

const callWith = async (
    inputs: Record<string, unknown>,
    target: { agent: string; workflow: string; version: "latest" | number } = TARGET,
) => {
    const fake = fakeNodePorts()
    const run = await runNode(
        {
            node: coreCallWorkflowNode,
            params: target,
            input: { inputs },
            turn: EXAMPLE_TURN,
            grant: {},
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "k",
        },
        fake.ports,
    )
    return { run, executed: fake.executed }
}

describe("core.call-workflow", () => {
    it("is the end hand-off step of the contract", () => {
        expect(coreCallWorkflowNode.id).toBe(CALL_WORKFLOW_STEP)
        expect(coreCallWorkflowNode.effects).toEqual(["nivo.tool.agent.tag"])
    })

    it("answers in each example the tag the example runner gives the first effect, by its literal id", () => {
        expect(coreCallWorkflowNode.examples.map((each) => each.output?.tag.id)).toEqual([
            "nivo.tool.agent.tag-1",
            "nivo.tool.agent.tag-1",
        ])
    })

    it.each(coreCallWorkflowNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreCallWorkflowNode, each, coreEffects)).resolves.toEqual([])
    })

    it("tags once, and answers the target it called with the tag it wrote", async () => {
        const { run, executed } = await callWith({ text: "Em mu\u1ed1n mua hoa", leadId: "l1" })

        expect(executed.map((one) => one.id)).toEqual(["nivo.tool.agent.tag"])
        expect(run.output).toMatchObject({ agent: "sales", workflow: "consult", version: "latest", tag: { kind: "nivo.tool.agent.tag" } })
    })

    it("carries ONLY the mapped inputs as the data of the target, with the pin of the workflow and the calling run", async () => {
        const { executed } = await callWith({ orderId: "o1", note: "giao s\u1edbm" })
        const payload = executed[0]?.payload

        expect(payload?.context).toEqual({
            [WORKFLOW_CALL_MEMBER]: { workflow: "consult", version: "latest" },
            [WORKFLOW_PARAMS_MEMBER]: { orderId: "o1", note: "giao s\u1edbm" },
            [CALLER_MEMBER]: { runId: EXAMPLE_TURN.turnId },
        })
        expect(payload).toMatchObject({ toModuleKey: "sales" })
        // `visibility` is deleted from the tag payload (R28: nothing reads it since the speaker machinery went).
        expect(payload).not.toHaveProperty("visibility")
        // Nothing the caller did not map rides along: no lead, conversation or channel the graph did not pass.
        expect(payload).not.toHaveProperty("leadId")
        expect(payload).not.toHaveProperty("conversationId")
        expect(payload).not.toHaveProperty("channel")
    })

    it("lets the lead, the conversation and the channel ride along when the target declares them", async () => {
        const { executed } = await callWith({ leadId: "l1", conversationId: "c1", channel: "zalo", text: "Ch\u00e0o shop" })

        expect(executed[0]?.payload).toMatchObject({
            leadId: "l1",
            conversationId: "c1",
            channel: "zalo",
            text: "Ch\u00e0o shop",
            context: { [WORKFLOW_PARAMS_MEMBER]: { leadId: "l1", conversationId: "c1", channel: "zalo", text: "Ch\u00e0o shop" } },
        })
    })

    it("pins a numbered version in the tag", async () => {
        const { executed, run } = await callWith({ orderId: "o1" }, { agent: "sales", workflow: "after-sale", version: 3 })

        expect(executed[0]?.payload).toMatchObject({ context: { [WORKFLOW_CALL_MEMBER]: { workflow: "after-sale", version: 3 } } })
        expect(run.output).toMatchObject({ version: 3 })
    })

    it("shows the neutral note when the hand-off passes no words, or only an empty or non-text value", async () => {
        const note = messageOf("vi", "nodeCoreCallWorkflowNote")

        expect((await callWith({ orderId: "o1" })).executed[0]?.payload.text).toBe(note)
        expect((await callWith({ text: "" })).executed[0]?.payload.text).toBe(note)
        expect((await callWith({ text: 5 })).executed[0]?.payload.text).toBe(note)
    })
})

describe("callPayloadOf", () => {
    it("shows the customer's words, cut to the line a chat shows", () => {
        expect(callPayloadOf(TARGET, { text: "a".repeat(2500) }, "r1").text).toHaveLength(2000)
    })

    it("leaves out a lead, conversation or channel that is not a non-empty text", () => {
        const payload = callPayloadOf(TARGET, { leadId: "", conversationId: 7, channel: null }, "r1")

        expect(payload).not.toHaveProperty("leadId")
        expect(payload).not.toHaveProperty("conversationId")
        expect(payload).not.toHaveProperty("channel")
    })

    it("copies the inputs, so the target's data is its own", () => {
        const inputs = { orderId: "o1" }
        const payload = callPayloadOf(TARGET, inputs, "r1")

        expect(payload.context).toMatchObject({ [WORKFLOW_PARAMS_MEMBER]: inputs, [CALLER_MEMBER]: { runId: "r1" } })
        expect(Object.values(payload.context ?? {})).not.toContain(inputs)
    })
})
