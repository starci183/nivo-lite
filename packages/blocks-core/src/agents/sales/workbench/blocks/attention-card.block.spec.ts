import { salesAttentionCardBlock } from "./attention-card.block"
import { salesBlocks } from "./sales-blocks"

const WORD = { key: "word" }

describe("sales.attention-card", () => {
    it("takes the words of the list, and a param and the kinds as options", () => {
        expect(salesAttentionCardBlock.props.safeParse({ label: WORD, empty: WORD }).success).toBe(true)
        expect(
            salesAttentionCardBlock.props.safeParse({
                label: WORD,
                empty: WORD,
                selectParam: "selected",
                kinds: ["waiting", "failed"],
            }).success,
        ).toBe(true)
    })

    it("refuses a kind it does not know, no kinds at all, and a param that is not a name", () => {
        const base = { label: WORD, empty: WORD }
        expect(salesAttentionCardBlock.props.safeParse({ ...base, kinds: ["other"] }).success).toBe(false)
        expect(salesAttentionCardBlock.props.safeParse({ ...base, kinds: [] }).success).toBe(false)
        expect(salesAttentionCardBlock.props.safeParse({ ...base, selectParam: "not a name" }).success).toBe(false)
    })

    it("binds the attention read and optionally the two other reads and a command for each kind", () => {
        expect(salesAttentionCardBlock.slots.attention).toEqual({ kind: "read", shape: "list", required: true })
        expect(Object.keys(salesAttentionCardBlock.slots)).toEqual([
            "attention",
            "awaitingReply",
            "parkedRuns",
            "respond",
            "follow",
            "reply",
            "review",
            "resume",
        ])
        expect(salesBlocks).toContain(salesAttentionCardBlock)
    })
})
