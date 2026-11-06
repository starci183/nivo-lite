import { approvalCardBlock } from "./approval-card.block"
import { chatbotBlocks } from "./chatbot-blocks"
import { inboxBlock } from "./inbox.block"
import { rulesBlock } from "./rules.block"

const PARAMS = { searchParam: "q", statusParam: "status", periodParam: "moved", selectParam: "selected" }

describe("inboxBlock", () => {
    it("is the Chatbot's own block, named for the module", () => {
        expect(inboxBlock.id).toBe("chatbot.inbox")
        expect(Object.keys(inboxBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("takes one child, the approval card, and names the params it writes", () => {
        expect(inboxBlock.children).toEqual({ max: 1, accepts: ["chatbot.approval-card"] })
        expect(inboxBlock.params).toEqual(["searchParam", "statusParam", "periodParam", "selectParam"])
    })

    it("takes the four param names and nothing about paths, words or proposals", () => {
        expect(inboxBlock.props.safeParse(PARAMS).success).toBe(true)
        expect(inboxBlock.props.safeParse({ ...PARAMS, selectParam: "" }).success).toBe(false)
        expect(inboxBlock.props.safeParse({ ...PARAMS, statusParam: undefined }).success).toBe(false)
        expect(inboxBlock.props.safeParse({ ...PARAMS, textPath: "text" }).success).toBe(true)
        expect(Object.keys(inboxBlock.props.parse({ ...PARAMS, textPath: "text" }))).toEqual([
            "searchParam",
            "statusParam",
            "periodParam",
            "selectParam",
        ])
    })

    it("needs the list, its counts, the lines and the thread, and leaves the actions to the spec", () => {
        const required = Object.entries(inboxBlock.slots).filter(([, slot]) => slot.required)
        expect(required.map(([name]) => name)).toEqual(["threads", "counts", "messages", "thread"])
        expect(Object.keys(inboxBlock.slots)).toEqual([
            "threads",
            "counts",
            "messages",
            "thread",
            "send",
            "handoff",
            "release",
        ])
    })
})

describe("approvalCardBlock", () => {
    it("is the card inside the thread, bound to the proposal read and the approving action", () => {
        expect(approvalCardBlock.id).toBe("chatbot.approval-card")
        expect(approvalCardBlock.children).toBe(false)
        expect(approvalCardBlock.slots).toEqual({
            proposal: { kind: "read", shape: "record", required: true },
            approve: { kind: "action", required: true },
            dismiss: { kind: "action", required: false },
        })
    })

    it("lets a spec shorten the changed reply and refuses one over the reply limit", () => {
        expect(approvalCardBlock.props.parse({}).maxLength).toBe(4000)
        expect(approvalCardBlock.props.safeParse({ maxLength: 500 }).success).toBe(true)
        expect(approvalCardBlock.props.safeParse({ maxLength: 4001 }).success).toBe(false)
        expect(approvalCardBlock.props.safeParse({ maxLength: 0 }).success).toBe(false)
    })
})

describe("rulesBlock", () => {
    it("takes no props: the two settings and their bounds are the module's", () => {
        expect(rulesBlock.id).toBe("chatbot.rules")
        expect(rulesBlock.props.safeParse({}).success).toBe(true)
        expect(rulesBlock.children).toBe(false)
        expect(rulesBlock.slots).toEqual({
            settings: { kind: "read", shape: "record", required: true },
            save: { kind: "action", required: true },
        })
    })
})

describe("chatbotBlocks", () => {
    it("lists the module's three blocks, all in the chatbot namespace", () => {
        expect(chatbotBlocks).toEqual([inboxBlock, approvalCardBlock, rulesBlock])
        expect(chatbotBlocks.every((block) => block.id.startsWith("chatbot."))).toBe(true)
    })
})
