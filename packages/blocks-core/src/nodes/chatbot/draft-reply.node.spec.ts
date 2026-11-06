import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { chatbotDraftReplyNode } from "./draft-reply.node"
import { draftKeyOf } from "./draft.policy"
import { chatMessageProposeEffect } from "./propose.effect"
import { chatbotSendApprovedNode } from "./send-approved.node"
import { approvedKeyOf } from "./draft.policy"

const effects = new Map(coreEffects.map((effect) => [effect.id, effect]))

describe("chatbot.draft-reply", () => {
    it.each(chatbotDraftReplyNode.examples)("holds its example: $name", async (example) => {
        await expect(nodeExampleMismatches(chatbotDraftReplyNode, example, coreEffects)).resolves.toEqual([])
    })

    it("stores the draft once per turn and conversation, and calls the AI once for its purpose", async () => {
        const [example] = chatbotDraftReplyNode.examples
        const fake = fakeNodePorts({ model: example.model })

        await runNode(
            {
                node: chatbotDraftReplyNode,
                params: {},
                input: example.input,
                turn: EXAMPLE_TURN,
                grant: example.grant ?? { rights: [] },
                effects,
                tools: new Map(),
                key: "k",
            },
            fake.ports,
        )

        expect(fake.executed.map((effect) => [effect.id, effect.dedupeKey])).toEqual([
            ["chat-message.propose", draftKeyOf("turn-1", "c1")],
        ])
    })

    it("needs no data right of its own and runs one declared effect", () => {
        expect(chatbotDraftReplyNode.rights).toEqual([])
        expect(chatbotDraftReplyNode.effects).toEqual(["chat-message.propose"])
    })
})

describe("chat-message.propose", () => {
    it("is installed with the core effects and takes a draft with the question it answers", () => {
        expect(coreEffects).toContain(chatMessageProposeEffect)
        expect(
            chatMessageProposeEffect.payload.safeParse({ conversationId: "c1", text: "Hi", asked: "Q" }).success,
        ).toBe(true)
        expect(chatMessageProposeEffect.payload.safeParse({ conversationId: "c1", text: "", asked: "Q" }).success).toBe(
            false,
        )
    })
})

describe("chatbot.send-approved", () => {
    const [example] = chatbotSendApprovedNode.examples

    it("holds its example", async () => {
        await expect(nodeExampleMismatches(chatbotSendApprovedNode, example, coreEffects)).resolves.toEqual([])
    })

    it("sends under the key of the stored line, so two paths of approval send once", async () => {
        const fake = fakeNodePorts()

        await runNode(
            {
                node: chatbotSendApprovedNode,
                params: {},
                input: example.input,
                turn: EXAMPLE_TURN,
                grant: example.grant ?? { rights: [] },
                effects,
                tools: new Map(),
                key: "k",
            },
            fake.ports,
        )

        expect(fake.executed.map((effect) => [effect.id, effect.dedupeKey])).toEqual([
            ["channel.send", approvedKeyOf("m1")],
        ])
    })
})
