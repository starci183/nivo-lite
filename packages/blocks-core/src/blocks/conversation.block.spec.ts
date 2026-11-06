import { conversationBlock, MAX_LENGTH_CEILING } from "./conversation.block"

const WORD = { key: "word" }
const BASE = {
    label: WORD,
    empty: WORD,
    pick: WORD,
    idPath: "id",
    textPath: "text",
    composer: true,
    selectParam: "selected",
}

describe("conversationBlock", () => {
    it("is the generic conversation of the core namespace, named for what it is", () => {
        expect(conversationBlock.id).toBe("core.conversation")
        expect(conversationBlock.children).toEqual({ max: 2 })
        expect(Object.keys(conversationBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("names selectParam as the prop that holds a spec param", () => {
        expect(conversationBlock.params).toEqual(["selectParam"])
    })

    it("takes the required props alone", () => {
        expect(conversationBlock.props.safeParse(BASE).success).toBe(true)
    })

    it("takes every optional path and the limit", () => {
        const parsed = conversationBlock.props.safeParse({
            ...BASE,
            authorPath: "author",
            timePath: "at",
            statusPath: "delivery",
            sidePath: "side",
            markPath: "mark",
            maxLength: 500,
        })
        expect(parsed.success).toBe(true)
    })

    it("refuses a spec that leaves a required prop out", () => {
        expect(conversationBlock.props.safeParse({ ...BASE, textPath: undefined }).success).toBe(false)
        expect(conversationBlock.props.safeParse({ ...BASE, selectParam: undefined }).success).toBe(false)
        expect(conversationBlock.props.safeParse({ ...BASE, composer: "yes" }).success).toBe(false)
    })

    it("refuses an empty param name and a limit outside the bounds", () => {
        expect(conversationBlock.props.safeParse({ ...BASE, selectParam: "" }).success).toBe(false)
        expect(conversationBlock.props.safeParse({ ...BASE, maxLength: 0 }).success).toBe(false)
        expect(conversationBlock.props.safeParse({ ...BASE, maxLength: 1.5 }).success).toBe(false)
        expect(conversationBlock.props.safeParse({ ...BASE, maxLength: MAX_LENGTH_CEILING + 1 }).success).toBe(false)
    })

    it("takes a head over the thread and a proposed reply, and refuses either one without its paths", () => {
        const head = { titlePath: "name", subtitlePath: "channel" }
        const proposal = {
            title: WORD,
            idPath: "id",
            textPath: "text",
            askedPath: "asked",
            notePath: "note",
            saveLabel: WORD,
            cancelLabel: WORD,
        }
        expect(conversationBlock.props.safeParse({ ...BASE, head: { titlePath: "name" }, proposal }).success).toBe(true)
        expect(conversationBlock.props.safeParse({ ...BASE, head, proposal }).success).toBe(true)
        expect(conversationBlock.props.safeParse({ ...BASE, listLabel: WORD, contactLabel: WORD }).success).toBe(true)
        expect(conversationBlock.props.safeParse({ ...BASE, head: { subtitlePath: "channel" } }).success).toBe(false)
        expect(
            conversationBlock.props.safeParse({ ...BASE, proposal: { ...proposal, textPath: undefined } }).success,
        ).toBe(false)
    })

    it("binds the messages as a required list and leaves every other slot optional", () => {
        expect(conversationBlock.slots).toEqual({
            messages: { kind: "read", shape: "list", required: true },
            thread: { kind: "read", shape: "record", required: false },
            proposal: { kind: "read", shape: "record", required: false },
            send: { kind: "action", required: false },
            handoff: { kind: "action", required: false },
            close: { kind: "action", required: false },
            approve: { kind: "action", required: false },
            edit: { kind: "action", required: false },
            reject: { kind: "action", required: false },
        })
    })
})
