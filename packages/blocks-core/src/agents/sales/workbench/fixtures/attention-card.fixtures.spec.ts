import { attentionEntriesOf, attentionListOf, parkedEntriesOf, ATTENTION_KINDS } from "../../rules/attention-list"
import { combinedSlots } from "../../../../shared/slots/combine"
import { salesAttentionCardBlock } from "../blocks/attention-card.block"
import { attentionCardFixtureProps, attentionCardFixtures } from "./attention-card.fixtures"
import type { AttentionFixtureSlots } from "./attention-card.fixtures"

const settled = (slots: AttentionFixtureSlots): ReturnType<typeof combinedSlots<unknown>> =>
    combinedSlots<unknown>([slots.attention, slots.awaitingReply, slots.parkedRuns])

describe("the attention card fixtures", () => {
    it("are props the block accepts", () => {
        expect(salesAttentionCardBlock.props.safeParse(attentionCardFixtureProps).success).toBe(true)
    })

    it("hold the five states a card is drawn in", () => {
        expect(Object.keys(attentionCardFixtures)).toEqual(["ready", "loading", "empty", "error", "waiting"])
        expect(settled(attentionCardFixtures.loading)).toEqual({ isLoading: true })
        expect(settled(attentionCardFixtures.empty)).toEqual({ isEmpty: true })
        expect(settled(attentionCardFixtures.error)).toEqual({ isError: true })
    })

    it("show every kind but the owner's in the ready state, in the order of the list", () => {
        const slots = attentionCardFixtures.ready
        const items = [
            ...("items" in slots.attention ? attentionEntriesOf(slots.attention.items) : []),
            ...("items" in slots.awaitingReply ? attentionEntriesOf(slots.awaitingReply.items) : []),
            ...("items" in slots.parkedRuns ? parkedEntriesOf(slots.parkedRuns.items) : []),
        ]
        expect(attentionListOf(items, ATTENTION_KINDS).map((item) => item.kind)).toEqual([
            "waiting",
            "overdue",
            "needs-reply",
            "failed",
        ])
    })

    it("wait on the owner with the order over the limit", () => {
        const slot = attentionCardFixtures.waiting.attention
        const items = "items" in slot ? attentionEntriesOf(slot.items) : []
        expect(items.map((item) => item.kind)).toEqual(["owner"])
    })
})
