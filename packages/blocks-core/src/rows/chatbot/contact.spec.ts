import { THREAD_CONTACT } from "../../fixtures/chatbot/inbox.fixtures"
import { contactOf, leadFactsOf } from "./contact"

describe("contactOf", () => {
    it("reads the customer, the channel, who answers and the lead behind the conversation", () => {
        expect(contactOf(THREAD_CONTACT, "Visitor")).toEqual({
            name: THREAD_CONTACT.name,
            channelName: "Zalo OA",
            avatar: "",
            handledBy: "",
            stage: "new",
            need: THREAD_CONTACT.need,
            phone: THREAD_CONTACT.phone,
            leadId: "lead-thu",
        })
    })

    it("carries the picture link of the customer", () => {
        expect(contactOf({ id: "t6", avatarUrl: "https://zalo.test/a.png" }, "Visitor")?.avatar).toBe(
            "https://zalo.test/a.png",
        )
    })

    it("names an unnamed visitor", () => {
        expect(contactOf({ id: "t4" }, "Visitor")?.name).toBe("Visitor")
    })

    it("draws no contact for something that is no conversation", () => {
        expect(contactOf({ name: "no id" }, "x")).toBeNull()
        expect(contactOf(null, "x")).toBeNull()
    })
})

describe("leadFactsOf", () => {
    it("lists the known facts in order and leaves out the rest", () => {
        const contact = contactOf(THREAD_CONTACT, "x")
        expect(contact === null ? [] : leadFactsOf(contact).map((fact) => fact.id)).toEqual(["stage", "need", "phone"])
        const bare = contactOf({ id: "t4", phone: "0900" }, "x")
        expect(bare === null ? [] : leadFactsOf(bare)).toEqual([{ id: "phone", text: "0900" }])
        const none = contactOf({ id: "t5" }, "x")
        expect(none === null ? [] : leadFactsOf(none)).toEqual([])
    })
})
