import { handlingChangeOf, isHeldByPerson, mayHandle, noticeOf } from "./handling"
import type { HandlingMember } from "./handling"

// Design change (ruling R43): the staff hold is the ENGINE's (the route names the member id of its holder): the rules compare member ids,
// not the shown name, and a change is what the chatbot asks of the engine's port (`take` / `hand-back`), not a stored holder.
const STAFF: HandlingMember = { memberId: "m-ha", displayName: "Ha", isManager: false }
const MANAGER: HandlingMember = { memberId: "m-lan", displayName: "Lan", isManager: true }

describe("isHeldByPerson", () => {
    it("is false for nobody, true for a member", () => {
        expect(isHeldByPerson(null)).toBe(false)
        expect(isHeldByPerson("m-ha")).toBe(true)
    })
})

describe("mayHandle", () => {
    it("lets staff act on a free conversation or one they hold", () => {
        expect(mayHandle(STAFF, null)).toBe(true)
        expect(mayHandle(STAFF, "m-ha")).toBe(true)
    })

    it("refuses staff a conversation another person holds, and lets a manager reassign it", () => {
        expect(mayHandle(STAFF, "m-minh")).toBe(false)
        expect(mayHandle(MANAGER, "m-minh")).toBe(true)
    })
})

describe("handlingChangeOf", () => {
    it("takes the route over for the member, also from another holder", () => {
        expect(handlingChangeOf(null, true, STAFF)).toBe("take")
        expect(handlingChangeOf("m-minh", true, MANAGER)).toBe("take")
    })

    it("hands a held route back to the agent", () => {
        expect(handlingChangeOf("m-ha", false, STAFF)).toBe("hand-back")
    })

    it("changes nothing when the route is already held that way", () => {
        expect(handlingChangeOf("m-ha", true, STAFF)).toBe("none")
        expect(handlingChangeOf(null, false, STAFF)).toBe("none")
    })
})

describe("noticeOf", () => {
    it("fills the member's name into every place of the template", () => {
        expect(noticeOf("{name} took over {name}'s chat", "Ha")).toBe("Ha took over Ha's chat")
    })
})
