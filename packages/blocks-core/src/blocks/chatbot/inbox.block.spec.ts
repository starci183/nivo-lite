import { chatbotBlocks } from "./chatbot-blocks"
import { inboxBlock } from "./inbox.block"
import { rulesBlock } from "./rules.block"

const PARAMS = { searchParam: "q", statusParam: "status", periodParam: "moved", selectParam: "selected" }

describe("inboxBlock", () => {
    it("is the Chatbot's own block, named for the module", () => {
        expect(inboxBlock.id).toBe("chatbot.inbox")
        expect(Object.keys(inboxBlock.propsJson).length).toBeGreaterThan(0)
    })

    // Design change (ruling R23): the chatbot's draft road is removed, so the approval card it took as its child is gone.
    it("takes no child and names the params it writes", () => {
        expect(inboxBlock.children).toBe(false)
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
    it("lists the module's two blocks, all in the chatbot namespace", () => {
        expect(chatbotBlocks).toEqual([inboxBlock, rulesBlock])
        expect(chatbotBlocks.every((block) => block.id.startsWith("chatbot."))).toBe(true)
    })
})
