import { handlingChangeOf, isHeldByPerson, mayHandle, noticeOf } from "./handling"
import type { HandlingMember } from "./handling"

const STAFF: HandlingMember = { displayName: "Ha", isManager: false }
const MANAGER: HandlingMember = { displayName: "Lan", isManager: true }

describe("isHeldByPerson", () => {
    it("is false for nobody, true for a person", () => {
        expect(isHeldByPerson(null)).toBe(false)
        expect(isHeldByPerson("Ha")).toBe(true)
    })
})

describe("mayHandle", () => {
    it("lets staff act on a free conversation or one they hold", () => {
        expect(mayHandle(STAFF, null)).toBe(true)
        expect(mayHandle(STAFF, "Ha")).toBe(true)
    })

    it("refuses staff a conversation another person holds, and lets a manager reassign it", () => {
        expect(mayHandle(STAFF, "Minh")).toBe(false)
        expect(mayHandle(MANAGER, "Minh")).toBe(true)
    })
})

describe("handlingChangeOf", () => {
    it("takes the conversation over under the member's name", () => {
        expect(handlingChangeOf(null, true, STAFF)).toEqual({ kind: "set", handledBy: "Ha" })
    })

    it("releases it back to the AI", () => {
        expect(handlingChangeOf("Ha", false, STAFF)).toEqual({ kind: "set", handledBy: null })
    })

    it("changes nothing when the conversation is already held that way", () => {
        expect(handlingChangeOf("Ha", true, STAFF)).toEqual({ kind: "none" })
        expect(handlingChangeOf(null, false, STAFF)).toEqual({ kind: "none" })
    })
})

describe("noticeOf", () => {
    it("fills the member's name into every place of the template", () => {
        expect(noticeOf("{name} took over {name}'s chat", "Ha")).toBe("Ha took over Ha's chat")
    })
})
