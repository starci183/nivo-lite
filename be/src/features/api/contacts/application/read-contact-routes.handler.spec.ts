import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactConversationService, type ContactRouteSummary } from "@modules/domain/customer-routes"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ContactNamesService } from "./contact-names.service"
import { ReadContactRoutesQuery } from "./contacts.queries"
import { ReadContactRoutesHandler } from "./read-contact-routes.handler"

const PRINCIPAL: Principal = { id: "user-1", role: "authenticated" }
const REQUEST = { workspaceId: "ws-1", contactId: "contact-1" }

const summaryOf = (over: Partial<ContactRouteSummary> = {}): ContactRouteSummary => ({
    routeId: "r-zalo",
    channel: "zalo",
    accountId: "conn-zalo",
    createdAt: "2026-11-01T00:00:00.000Z",
    lastLineAt: "2026-11-14T09:00:00.000Z",
    lastAgentId: "agent-1",
    hold: null,
    ...over,
})

const build = () => {
    const access = mock<AgentWorkAccessService>()
    const conversation = mock<ContactConversationService>()
    const names = mock<ContactNamesService>()
    access.manager.mockResolvedValue("member-1")
    conversation.routesOf.mockResolvedValue([])
    names.connectionsOf.mockResolvedValue(new Map())
    names.agentsOf.mockResolvedValue(new Map())
    names.membersOf.mockResolvedValue(new Map())
    return { access, conversation, names, handler: new ReadContactRoutesHandler(mock<Logger>(), access, conversation, names) }
}

const run = (handler: ReadContactRoutesHandler) => handler.execute(new ReadContactRoutesQuery({ request: REQUEST, principal: PRINCIPAL }))

describe("ReadContactRoutesHandler (contact.routes)", () => {
    it("names each route's connection and the workbench of the agent that spoke last, with the time of its last line", async () => {
        const { handler, conversation, names, access } = build()
        conversation.routesOf.mockResolvedValue([summaryOf()])
        names.connectionsOf.mockResolvedValue(new Map([["conn-zalo", { name: "Shop Hoa Zalo", provider: "zalo" }]]))
        names.agentsOf.mockResolvedValue(
            new Map([["agent-1", { agentId: "agent-1", name: "Lan", moduleKey: "chatbot", installationId: "inst-1" }]]),
        )

        await expect(run(handler)).resolves.toEqual([
            {
                routeId: "r-zalo",
                channel: "zalo",
                accountId: "conn-zalo",
                accountName: "Shop Hoa Zalo",
                provider: "zalo",
                lastLineAt: "2026-11-14T09:00:00.000Z",
                workbench: { agentId: "agent-1", agentName: "Lan", moduleKey: "chatbot", installationId: "inst-1" },
                holder: null,
            },
        ])
        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(conversation.routesOf).toHaveBeenCalledWith("ws-1", "contact-1")
    })

    it("shows a held route with the member who holds it and when, and the name null when the seat is gone", async () => {
        const { handler, conversation, names } = build()
        conversation.routesOf.mockResolvedValue([
            summaryOf({ routeId: "r-1", hold: { memberId: "member-9", at: "2026-11-14T08:30:00.000Z" } }),
            summaryOf({ routeId: "r-2", hold: { memberId: "member-gone", at: "2026-11-14T08:40:00.000Z" } }),
        ])
        names.membersOf.mockResolvedValue(new Map([["member-9", "Minh"]]))

        const routes = await run(handler)

        expect(routes.map((route) => route.holder)).toEqual([
            { memberId: "member-9", name: "Minh", at: "2026-11-14T08:30:00.000Z" },
            { memberId: "member-gone", name: null, at: "2026-11-14T08:40:00.000Z" },
        ])
        expect(names.membersOf).toHaveBeenCalledWith(["member-9", "member-gone"])
    })

    it("has no workbench for a route no agent spoke on, an agent whose installation is gone, and no connection name for a site entrance", async () => {
        const { handler, conversation, names } = build()
        conversation.routesOf.mockResolvedValue([
            summaryOf({ routeId: "r-new", lastAgentId: null, lastLineAt: null }),
            summaryOf({ routeId: "r-orphan", lastAgentId: "agent-2" }),
            summaryOf({ routeId: "r-web", channel: "website", accountId: "site-1", lastAgentId: null }),
        ])
        names.agentsOf.mockResolvedValue(
            new Map([["agent-2", { agentId: "agent-2", name: "Cũ", moduleKey: "chatbot", installationId: null }]]),
        )

        const routes = await run(handler)

        expect(routes.map((route) => [route.routeId, route.workbench, route.accountName, route.provider])).toEqual([
            ["r-new", null, null, null],
            ["r-orphan", null, null, null],
            ["r-web", null, null, null],
        ])
    })

    it("answers none, and names nothing, for a contact with no live route (a deleted contact, a removed connection)", async () => {
        const { handler, names } = build()

        await expect(run(handler)).resolves.toEqual([])
        expect(names.connectionsOf).not.toHaveBeenCalled()
    })

    it("refuses a person without the owner or manager seat before reading anything", async () => {
        const { handler, access, conversation } = build()
        access.manager.mockRejectedValue(new Error("not a manager"))

        await expect(run(handler)).rejects.toThrow("not a manager")
        expect(conversation.routesOf).not.toHaveBeenCalled()
    })
})
