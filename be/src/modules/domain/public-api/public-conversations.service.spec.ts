import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { PublicConversationsService } from "./public-conversations.service"

const build = async () => {
    const routes = mock<CustomerRoutesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PublicConversationsService, { provide: CustomerRoutesService, useValue: routes }],
    }).compile()
    return { service: moduleRef.get(PublicConversationsService), routes }
}

describe("PublicConversationsService", () => {
    it("finds a customer conversation of the workspace by its ROUTE id, with the person and the entrance", async () => {
        const { service, routes } = await build()
        routes.get.mockResolvedValue({
            id: "route-1",
            contactId: "contact-1",
            channel: "zalo",
            accountId: "conn-1",
            createdAt: "2026-11-14T00:00:00.000Z",
        })

        await expect(service.find("ws-1", "route-1")).resolves.toEqual({
            id: "route-1",
            contactId: "contact-1",
            channel: "zalo",
            accountId: "conn-1",
        })

        expect(routes.get).toHaveBeenCalledWith("ws-1", "route-1")
    })

    it("answers nothing for an id no route of the workspace holds (another workspace's, or a chat record's)", async () => {
        const { service, routes } = await build()
        routes.get.mockResolvedValue(null)

        await expect(service.find("ws-1", "missing")).resolves.toBeUndefined()
    })
})
