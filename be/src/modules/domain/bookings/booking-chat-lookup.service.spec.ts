import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingChatLookupService } from "./booking-chat-lookup.service"
import type { CancellableRowFacts } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"

const WORKSPACE = "ws-1"
const CONVERSATION = "conversation-1"
const NOW = Date.UTC(2026, 9, 11, 5, 0)
const MONDAY_NINE = "2026-10-12T02:00:00.000Z"
const NEXT_ROW: CancellableRowFacts = {
    id: "b-next",
    lead_id: "lead-1",
    customer_name: "Mai",
    service_id: "service-1",
    start_ms: Date.parse(MONDAY_NINE),
}

const servicesNamed = (names: ReadonlyMap<string, string>) =>
    mock<BookingServicesReadService>({ namesOf: jest.fn(() => Promise.resolve(names)) })

const build = async (row?: CancellableRowFacts, names: ReadonlyMap<string, string> = new Map([["service-1", "Cut"]])) => {
    const entityManager = mockEntityManager()
    const fake = fakeQueryBuilder({ getRawOne: row })
    entityManager.createQueryBuilder.mockReturnValue(fake.builder)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingChatLookupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: BookingServicesReadService, useValue: servicesNamed(names) },
        ],
    }).compile()
    return { service: moduleRef.get(BookingChatLookupService), entityManager, fake }
}

describe("BookingChatLookupService", () => {
    describe("nextOfChat", () => {
        it.each(["lead-1", null])("maps the next booking for a chat with lead %s", async (leadId) => {
            const { service, entityManager, fake } = await build({ ...NEXT_ROW, lead_id: leadId })
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId, conversationId: CONVERSATION }, NOW),
            ).resolves.toEqual({
                id: "b-next",
                leadId,
                customerName: "Mai",
                serviceName: "Cut",
                startIso: MONDAY_NINE,
            })
            expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(BookingEntity, "b")
            expect(fake.callsOf("where")).toEqual([["b.workspaceId = :workspaceId", { workspaceId: WORKSPACE }]])
            expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ leadId, conversationId: CONVERSATION })
            expect(fake.callsOf("andWhere")[2]).toEqual(["b.startAt > :now", { now: new Date(NOW) }])
            expect(fake.callsOf("limit")).toEqual([[1]])
            expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
        })

        it("answers null when the chat has no open future booking", async () => {
            const { service, entityManager } = await build()
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId: "lead-1", conversationId: CONVERSATION }, NOW),
            ).resolves.toBeNull()
            expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
        })

        it("answers null when the service of the booking is gone", async () => {
            const { service } = await build(NEXT_ROW, new Map())
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId: "lead-1", conversationId: CONVERSATION }, NOW),
            ).resolves.toBeNull()
        })
    })
})

const lookupOver = async (entityManager: ReturnType<typeof mockEntityManager>) =>
    (
        await Test.createTestingModule({
            providers: [
                BookingChatLookupService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
                { provide: BookingServicesReadService, useValue: servicesNamed(new Map()) },
            ],
        }).compile()
    ).get(BookingChatLookupService)

describe("BookingChatLookupService installationIdOf", () => {
    it("answers the installation a row of the workspace names", async () => {
        const em = mockEntityManager({
            findOne: [BookingEntity, Object.assign(new BookingEntity(), { installationId: "inst-1" })],
        })

        await expect((await lookupOver(em)).installationIdOf("ws-1", "rec-1")).resolves.toBe("inst-1")
        expect(em.findOne).toHaveBeenCalledWith(BookingEntity, {
            select: { installationId: true },
            where: { workspaceId: "ws-1", id: "rec-1" },
        })
    })

    it("answers null for a missing row and for a row that names no installation", async () => {
        const em = mockEntityManager({ findOne: [BookingEntity, null] })
        await expect((await lookupOver(em)).installationIdOf("ws-1", "rec-1")).resolves.toBeNull()

        const bare = mockEntityManager({
            findOne: [BookingEntity, Object.assign(new BookingEntity(), { installationId: null })],
        })
        await expect((await lookupOver(bare)).installationIdOf("ws-1", "rec-1")).resolves.toBeNull()
    })
})
