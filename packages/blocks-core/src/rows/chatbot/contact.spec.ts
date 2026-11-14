import { THREAD_CONTACT } from "../../fixtures/chatbot/inbox.fixtures"
import { contactOf } from "./contact"

describe("contactOf", () => {
    it("reads the customer, the channel, who answers and the contact behind the conversation", () => {
        expect(contactOf(THREAD_CONTACT, "Visitor")).toEqual({
            name: THREAD_CONTACT.name,
            channelName: "Zalo OA",
            avatar: "",
            handledBy: "",
            contactId: "0c0a0000-0000-4000-8000-0000000000c1",
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
