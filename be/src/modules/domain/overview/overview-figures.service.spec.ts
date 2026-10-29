import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OverviewFiguresService } from "./overview-figures.service"
import { windowAt } from "./overview.policy"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OverviewFiguresService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OverviewFiguresService)
}

const WINDOW = windowAt(new Date("2026-10-13T03:00:00.000Z"))

describe("OverviewFiguresService.promo", () => {
    it("composes the onboarding facts from its reads in one repeatable-read transaction", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: { id: "bot-1", knowledge: "hours" } },
            { getExists: true },
            { getRawMany: [{ id: "l-web", createdAt: "2026-10-01T00:00:00+00:00" }] },
            {},
            { getRawMany: [{ leadId: "l-web", at: "2026-10-01T01:00:00+00:00" }] },
            { getExists: true },
            { getExists: false },
            { getRawOne: { count: 2 } },
            {},
            { getExists: true },
            {},
            { getExists: true },
        ])
        const service = await build(em)

        await expect(service.promo("ws-1", WINDOW)).resolves.toEqual({
            chatbot: { id: "bot-1", knowledge: "hours" },
            isFoundingMember: true,
            websiteLeads: [{ id: "l-web", createdAt: "2026-10-01T00:00:00+00:00" }],
            firstEvents: [{ leadId: "l-web", at: "2026-10-01T01:00:00+00:00" }],
            hasCustomerConversation: true,
            hasLeadConversation: false,
            approvedCount: 2,
            hasWon: true,
            invoiceApproved: true,
        })
        expect(em.transaction).toHaveBeenCalledWith("REPEATABLE READ", expect.any(Function))
    })

    it("answers blank facts for a workspace that recorded nothing", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: undefined },
            { getExists: false },
            { getRawMany: [] },
            {},
            { getRawMany: [] },
            { getExists: false },
            { getExists: false },
            { getRawOne: undefined },
            {},
            { getExists: false },
            {},
            { getExists: false },
        ])
        const service = await build(em)

        await expect(service.promo("ws-1", WINDOW)).resolves.toEqual({
            chatbot: null,
            isFoundingMember: false,
            websiteLeads: [],
            firstEvents: [],
            hasCustomerConversation: false,
            hasLeadConversation: false,
            approvedCount: 0,
            hasWon: false,
            invoiceApproved: false,
        })
    })
})

describe("OverviewFiguresService.governance", () => {
    it("answers null authority and zero counts when the rows are missing", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: undefined },
            { getRawMany: [] },
            { getRawMany: [] },
            { getRawMany: [] },
            { getRawMany: [] },
            { getRawMany: [] },
            { getRawOne: undefined },
            { getRawMany: [] },
            { getRawMany: [] },
            {},
        ])
        const service = await build(em)

        await expect(service.governance("ws-1", WINDOW.since7)).resolves.toEqual({
            authority: null,
            leads: [],
            orders: [],
            invoices: [],
            transactions: [],
            work: [],
            pendingWithoutWork: 0,
            decisions7: [],
            recent: [],
        })
    })

    it("composes the rows of every block and the pending count", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: { goalRevenueVnd: 5, goalNewCustomers: 2, goalFirstReplyMinutes: 3 } },
            { getRawMany: [{ id: "l-1" }] },
            { getRawMany: [{ id: "o-1" }] },
            { getRawMany: [{ id: "i-1" }] },
            { getRawMany: [{ id: "t-1" }] },
            { getRawMany: [{ id: "w-1" }] },
            { getRawOne: { count: 4 } },
            { getRawMany: [{ workItemId: "w-1" }] },
            { getRawMany: [{ id: "d-1" }] },
            {},
        ])
        const service = await build(em)

        await expect(service.governance("ws-1", WINDOW.since7)).resolves.toEqual({
            authority: { goalRevenueVnd: 5, goalNewCustomers: 2, goalFirstReplyMinutes: 3 },
            leads: [{ id: "l-1" }],
            orders: [{ id: "o-1" }],
            invoices: [{ id: "i-1" }],
            transactions: [{ id: "t-1" }],
            work: [{ id: "w-1" }],
            pendingWithoutWork: 4,
            decisions7: [{ workItemId: "w-1" }],
            recent: [{ id: "d-1" }],
        })
    })
})
