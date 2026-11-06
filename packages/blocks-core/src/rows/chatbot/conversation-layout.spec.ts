import { conversationLayoutOf } from "./conversation-layout"

describe("conversationLayoutOf", () => {
    it("shows the list on a phone until a thread is chosen, then the thread", () => {
        const none = conversationLayoutOf({ hasList: true, hasThread: false, hasContact: true })
        expect(none.base.areas).toEqual(["list"])
        const chosen = conversationLayoutOf({ hasList: true, hasThread: true, hasContact: true })
        expect(chosen.base.areas).toEqual(["thread"])
    })

    it("puts the list beside the thread from a medium width and the contact from a wide one", () => {
        const layout = conversationLayoutOf({ hasList: true, hasThread: true, hasContact: true })
        expect(layout.medium).toEqual({ areas: ["list thread"], columns: ["standard", "fill"] })
        expect(layout.wide).toEqual({ areas: ["list thread contact"], columns: ["standard", "fill", "standard"] })
    })

    it("leaves the contact out when none is shown", () => {
        const layout = conversationLayoutOf({ hasList: true, hasThread: true, hasContact: false })
        expect(layout.wide.areas).toEqual(["list thread"])
    })

    it("draws only the thread when no list is bound", () => {
        const layout = conversationLayoutOf({ hasList: false, hasThread: false, hasContact: false })
        expect(layout.base.areas).toEqual(["thread"])
        expect(layout.medium).toEqual({ areas: ["thread"], columns: ["fill"] })
        expect(layout.wide.areas).toEqual(["thread"])
    })
})
