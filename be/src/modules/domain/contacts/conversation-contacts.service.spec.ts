import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { ConversationContactsService } from "./conversation-contacts.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ROUTE = "22222222-2222-4222-8222-222222222222"
const AT = "2026-11-10T03:00:00.000Z"

const build = async () => {
    const routes = mock<CustomerRoutesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [ConversationContactsService, { provide: CustomerRoutesService, useValue: routes }],
    }).compile()
    return { service: moduleRef.get(ConversationContactsService), routes }
}

describe("ConversationContactsService", () => {
    it("reads the contact of a conversation from its route, as the person stands now", async () => {
        const { service, routes } = await build()
        routes.get.mockResolvedValueOnce({ id: ROUTE, contactId: "contact-1", channel: "zalo", accountId: "oa-1", createdAt: AT })

        await expect(service.contactOf(WS, ROUTE)).resolves.toBe("contact-1")
        expect(routes.get).toHaveBeenCalledWith(WS, ROUTE)
    })

    it("answers null for an id no route of the workspace holds", async () => {
        const { service, routes } = await build()
        routes.get.mockResolvedValueOnce(null)

        await expect(service.contactOf(WS, "not-a-route")).resolves.toBeNull()
    })
})
