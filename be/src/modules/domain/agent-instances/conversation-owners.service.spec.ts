import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { ConversationOwnersService } from "./conversation-owners.service"

const build = async (route: string | null = null) => {
    const routes = mock<CustomerRoutesService>()
    routes.get.mockResolvedValue(
        route === null ? null : { id: "r-1", contactId: "contact-1", channel: "telegram", accountId: route, createdAt: "x" },
    )
    const owners = mock<ChannelOwnersService>()
    owners.ownerOf.mockResolvedValue({
        connectionId: "tg-1",
        agentId: "sales-lan",
        agentName: "Lan",
        module: "sales",
        purpose: "outbound_chat",
        grantedAt: new Date("2026-11-01T00:00:00.000Z"),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationOwnersService,
            { provide: ChannelOwnersService, useValue: owners },
            { provide: CustomerRoutesService, useValue: routes },
        ],
    }).compile()
    return { service: moduleRef.get(ConversationOwnersService), owners, routes }
}

describe("ConversationOwnersService", () => {
    it("answers the agent of the role that owns the entrance the route names, from the engine's own route row", async () => {
        const { service, routes, owners } = await build("tg-1")

        await expect(service.ownerAgentOf("ws-1", "r-1", "sales")).resolves.toBe("sales-lan")
        expect(routes.get).toHaveBeenCalledWith("ws-1", "r-1")
        expect(owners.ownerOf).toHaveBeenCalledWith("tg-1", "sales")
    })

    it("answers none when no agent of the role answers the channel", async () => {
        const { service, owners } = await build("tg-1")
        owners.ownerOf.mockResolvedValue(null)

        await expect(service.ownerAgentOf("ws-1", "r-1", "sales")).resolves.toBeNull()
    })

    it("answers none, asking no channel, for a route with no entrance account (website) or not in the workspace", async () => {
        const website = await build(null)
        website.routes.get.mockResolvedValue({ id: "r-2", contactId: "contact-1", channel: "website", accountId: null, createdAt: "x" })
        const missing = await build(null)

        await expect(website.service.ownerAgentOf("ws-1", "r-2", "sales")).resolves.toBeNull()
        await expect(missing.service.ownerAgentOf("ws-1", "c-x", "sales")).resolves.toBeNull()
        expect(website.owners.ownerOf).not.toHaveBeenCalled()
        expect(missing.owners.ownerOf).not.toHaveBeenCalled()
    })
})
