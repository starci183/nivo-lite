import { channelSendEffect, type EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { agentMessagePostEffect, defineAgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import { effectManifestsOf } from "@modules/domain/tools/adapters/effect-tools.policy"
import { CARD_KIND_NOT_POSTABLE, CARD_PAYLOAD_INVALID, postedCardOf } from "./team-card-post.policy"
import { z } from "zod"

const KIND = defineAgentMessageKind({
    id: "tcore.card",
    payload: z.object({ no: z.string(), total: z.number() }),
    actions: { approve: false, edit: "none", reject: false },
})
const POST = {
    kind: "tcore.card",
    intent: "notify" as const,
    title: "Card 7",
    summary: "Card 7 · 12",
    payload: { no: "7", total: 12 },
}

/** The tool a model is offered for one effect: the gateway's input schema and the check its arguments pass. */
const toolOf = (effect: EffectDefinition) => {
    const [manifest] = effectManifestsOf([effect])
    const [tool] = manifest?.tools ?? []
    if (tool === undefined) throw new Error("no tool")
    return tool
}

describe("postedCardOf", () => {
    it("stores a finished card of the kind a plugin registered, as it was given", () => {
        expect(postedCardOf(POST, KIND)).toEqual({ message: POST })
    })

    it("refuses a kind no plugin registers and content that is not of the kind's shape", () => {
        expect(postedCardOf(POST, null)).toEqual({ refused: CARD_KIND_NOT_POSTABLE })
        expect(postedCardOf({ ...POST, kind: "tcore.other" }, KIND)).toEqual({ refused: CARD_KIND_NOT_POSTABLE })
        expect(postedCardOf({ ...POST, payload: { no: 7 } }, KIND)).toEqual({ refused: CARD_PAYLOAD_INVALID })
    })
})

describe("the tool a model is offered for the team post and the customer send", () => {
    it("takes words and answers only: a finished card, whatever amounts it carries, is refused before any executor sees it", () => {
        const tool = toolOf(agentMessagePostEffect)
        expect(
            tool.argumentSchema.safeParse({ kind: "message.text", intent: "notify", title: "Hi", text: "Hello" })
                .success,
        ).toBe(true)
        expect(tool.argumentSchema.safeParse(POST).success).toBe(false)
        expect(
            tool.argumentSchema.safeParse({ ...POST, kind: "order.summary", payload: { amountText: "0 ₫" } }).success,
        ).toBe(false)
        expect(JSON.stringify(tool.inputSchema)).not.toContain("finished card")
    })

    it("shows the model no order card on a customer line: no amount and no paid typed by a model", () => {
        const tool = toolOf(channelSendEffect)
        expect(JSON.stringify(tool.inputSchema)).not.toContain('"order"')
        // The send names the person by `contactId` (default: the person the run serves); it has no `conversationId` member any more
        // (the route is the engine's, read from the run), so the typed call names the contact.
        const typed = {
            contactId: "c1",
            text: "Hello",
            order: { orderNo: "DH-1", lines: [], amountText: "0", address: "", paid: true },
        }
        // The arguments the gateway hands the executor are the PARSED ones: the typed card is dropped, never delivered.
        expect(effectParsed(channelSendEffect, typed)).toEqual({ contactId: "c1", text: "Hello" })
    })
})

const effectParsed = (effect: EffectDefinition, args: unknown): unknown => effect.payload.safeParse(args).data
