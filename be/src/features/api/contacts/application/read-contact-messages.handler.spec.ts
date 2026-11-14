import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactsService, type ContactWithIdentities } from "@modules/domain/contacts"
import { ContactConversationService, type CustomerLine } from "@modules/domain/customer-routes"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ContactNamesService } from "./contact-names.service"
import { ReadContactMessagesQuery } from "./contacts.queries"
import { ReadContactMessagesHandler } from "./read-contact-messages.handler"

const PRINCIPAL: Principal = { id: "user-1", role: "authenticated" }
const REQUEST = { workspaceId: "ws-1", contactId: "contact-1" }

const lineOf = (id: string, over: Partial<CustomerLine> = {}): CustomerLine => ({
    id,
    seq: "1",
    routeId: "r-zalo",
    contactId: "contact-1",
    direction: "from_person",
    key: `key-${id}`,
    saidAt: "2026-11-14T09:00:00.000Z",
    text: `text ${id}`,
    files: [],
    order: null,
    eventId: null,
    agentId: null,
    memberId: null,
    runId: null,
    stepKey: null,
    state: null,
    reason: null,
    channel: "zalo",
    accountId: "conn-zalo",
    deliveredAt: null,
    ...over,
})

const build = () => {
    const access = mock<AgentWorkAccessService>()
    const conversation = mock<ContactConversationService>()
    const contacts = mock<ContactsService>()
    const names = mock<ContactNamesService>()
    access.manager.mockResolvedValue("member-1")
    conversation.linesOf.mockResolvedValue({ rows: [], next: null })
    contacts.get.mockResolvedValue({ id: "contact-1", displayName: "Chị Hoa" } as ContactWithIdentities)
    names.agentsOf.mockResolvedValue(new Map())
    names.membersOf.mockResolvedValue(new Map())
    return { access, conversation, contacts, names, handler: new ReadContactMessagesHandler(mock<Logger>(), access, conversation, contacts, names) }
}

const run = (handler: ReadContactMessagesHandler, over: Partial<ConstructorParameters<typeof ReadContactMessagesQuery>[0]["request"]> = {}) =>
    handler.execute(new ReadContactMessagesQuery({ request: { ...REQUEST, ...over }, principal: PRINCIPAL }))

describe("ReadContactMessagesHandler (contactMessages)", () => {
    it("resolves who spoke each line on the server: the person, an agent by name, a member of the shop by name", async () => {
        const { handler, conversation, names } = build()
        conversation.linesOf.mockResolvedValue({
            rows: [
                lineOf("l3", { direction: "to_person", memberId: "member-1", agentId: "agent-1", state: "delivered", routeId: "r-tg", channel: "telegram" }),
                lineOf("l2", { direction: "to_person", agentId: "agent-1", state: "delivered" }),
                lineOf("l1"),
            ],
            next: "1763089140000.7",
        })
        names.agentsOf.mockResolvedValue(
            new Map([["agent-1", { agentId: "agent-1", name: "Lan", moduleKey: "chatbot", installationId: "inst-1" }]]),
        )
        names.membersOf.mockResolvedValue(new Map([["member-1", "Minh"]]))

        const page = await run(handler)

        expect(page.next).toBe("1763089140000.7")
        expect(page.rows.map((line) => [line.id, line.routeId, line.channel, line.direction, line.speaker])).toEqual([
            ["l3", "r-tg", "telegram", "to_person", { kind: "staff", name: "Minh" }],
            ["l2", "r-zalo", "zalo", "to_person", { kind: "agent", name: "Lan" }],
            ["l1", "r-zalo", "zalo", "from_person", { kind: "person", name: "Chị Hoa" }],
        ])
        expect(names.membersOf).toHaveBeenCalledWith(["member-1", null, null])
    })

    it("takes a member who typed a line over the agent whose installation sent it (a typed reply is the member's)", async () => {
        const { handler, conversation, names } = build()
        conversation.linesOf.mockResolvedValue({ rows: [lineOf("l1", { direction: "to_person", memberId: "member-1", agentId: "agent-1" })], next: null })
        names.agentsOf.mockResolvedValue(new Map([["agent-1", { agentId: "agent-1", name: "Lan", moduleKey: "chatbot", installationId: "inst-1" }]]))
        names.membersOf.mockResolvedValue(new Map([["member-1", "Minh"]]))

        expect((await run(handler)).rows[0]?.speaker).toEqual({ kind: "staff", name: "Minh" })
    })

    it("keeps the speaker with no name when it is not known: a person with no name, a seat or an agent that is gone, a line the engine told itself", async () => {
        const { handler, conversation, contacts } = build()
        contacts.get.mockResolvedValue({ id: "contact-1", displayName: null } as ContactWithIdentities)
        conversation.linesOf.mockResolvedValue({
            rows: [
                lineOf("l4"),
                lineOf("l3", { direction: "to_person", memberId: "member-gone" }),
                lineOf("l2", { direction: "to_person", agentId: "agent-gone" }),
                lineOf("l1", { direction: "to_person" }),
            ],
            next: null,
        })

        expect((await run(handler)).rows.map((line) => line.speaker)).toEqual([
            { kind: "person", name: null },
            { kind: "staff", name: null },
            { kind: "agent", name: null },
            { kind: "agent", name: null },
        ])
    })

    it("carries the files, the order card and the delivery state of a line and passes the route, the cursor and the limit to the one merged read", async () => {
        const { handler, conversation } = build()
        const files = [{ url: "https://files.example/p.jpg", name: "p.jpg", contentType: "image/jpeg", caption: "Bó hoa" }]
        conversation.linesOf.mockResolvedValue({
            rows: [lineOf("l1", { direction: "to_person", agentId: "agent-1", state: "refused", files, order: { id: "o-1", total: 350000 } })],
            next: null,
        })

        const page = await run(handler, { routeId: "r-zalo", before: "1763089140000.7", limit: 20 })

        expect(conversation.linesOf).toHaveBeenCalledWith("ws-1", "contact-1", { routeId: "r-zalo", before: "1763089140000.7", limit: 20 })
        expect(page.rows[0]).toMatchObject({ files, order: { id: "o-1", total: 350000 }, state: "refused", accountId: "conn-zalo" })
    })

    it("reads every route when none is named, and does not read the contact when nobody in the page is the person", async () => {
        const { handler, conversation, contacts } = build()
        conversation.linesOf.mockResolvedValue({ rows: [lineOf("l1", { direction: "to_person", agentId: "agent-1" })], next: null })

        await run(handler)

        expect(conversation.linesOf).toHaveBeenCalledWith("ws-1", "contact-1", { routeId: null, before: null, limit: undefined })
        expect(contacts.get).not.toHaveBeenCalled()
    })

    it("answers an empty page, and names nobody, for a deleted contact or a removed connection's routes", async () => {
        const { handler, names } = build()

        await expect(run(handler)).resolves.toEqual({ rows: [], next: null })
        expect(names.agentsOf).not.toHaveBeenCalled()
    })

    it("refuses a person without the owner or manager seat before reading anything", async () => {
        const { handler, access, conversation } = build()
        access.manager.mockRejectedValue(new Error("not a manager"))

        await expect(run(handler)).rejects.toThrow("not a manager")
        expect(conversation.linesOf).not.toHaveBeenCalled()
    })
})
