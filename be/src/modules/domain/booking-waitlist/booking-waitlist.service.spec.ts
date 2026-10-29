import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { BookingServiceEntity } from "@modules/domain/booking-services"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistService } from "./booking-waitlist.service"
import type { WaitlistEntry } from "./booking-waitlist.contracts"
import { BookingWaitlistEntity } from "./persistence/entities"

const entryOf = builder<WaitlistEntry>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    conversationId: "conversation-1",
    customerName: " Mai ",
    customerPhone: "84912345678",
    serviceId: "service-1",
    windowStart: "2026-10-15T02:00:00.000Z",
    windowEnd: "2026-10-15T11:00:00.000Z",
    partySize: 2,
    note: " afternoon preferred ",
})

const WINDOW = {
    workspaceId: "ws-1",
    serviceId: "service-1",
    status: "waiting",
    windowStart: new Date("2026-10-15T02:00:00.000Z"),
    windowEnd: new Date("2026-10-15T11:00:00.000Z"),
}

const savedOf = (overrides: Record<string, unknown> = {}) => ({
    workspaceId: "ws-1",
    leadId: "lead-1",
    conversationId: "conversation-1",
    customerName: "Mai",
    customerPhone: "84912345678",
    serviceId: "service-1",
    windowStart: WINDOW.windowStart,
    windowEnd: WINDOW.windowEnd,
    partySize: 2,
    note: "afternoon preferred",
    ...overrides,
})

/** A manager whose join runs in a transaction that first locks the service row, then checks and inserts. */
const joining = (waiting: boolean) => {
    const em = mockEntityManager({ exists: [BookingWaitlistEntity, waiting], insert: [BookingWaitlistEntity, {}] })
    const lock = fakeQueryBuilder({ getOne: { id: "service-1" } })
    em.createQueryBuilder.mockReturnValue(lock.builder)
    fakeTransaction(em)
    return { em, lock }
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingWaitlistService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingWaitlistService)
}

describe("BookingWaitlistService cancel", () => {
    it("cancels an entry of the workspace and answers its id", async () => {
        const em = mockEntityManager({ update: [BookingWaitlistEntity, { affected: 1 }] })
        const waitlist = await build(em)

        await expect(waitlist.cancel("ws-1", "w-1")).resolves.toEqual([{ id: "w-1" }])
        expect(em.update).toHaveBeenCalledWith(
            BookingWaitlistEntity,
            { workspaceId: "ws-1", id: "w-1" },
            { status: "cancelled" },
        )
    })

    it("answers nothing for an entry of another workspace, through the caller's manager", async () => {
        const own = mockEntityManager()
        const caller = mockEntityManager({ update: [BookingWaitlistEntity, { affected: 0 }] })
        const waitlist = await build(own)

        await expect(waitlist.cancel("ws-1", "w-9", caller)).resolves.toEqual([])
        expect(own.update).not.toHaveBeenCalled()
    })

    it("answers nothing when the database does not say how many rows changed", async () => {
        const em = mockEntityManager({ update: [BookingWaitlistEntity, {}] })
        const waitlist = await build(em)

        await expect(waitlist.cancel("ws-1", "w-1")).resolves.toEqual([])
    })
})
describe("BookingWaitlistService join", () => {
    it("joins a customer to the service window and answers true when an entry was added", async () => {
        const { em, lock } = joining(false)
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf())).resolves.toBe(true)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(BookingServiceEntity, "s")
        expect(lock.callsOf("setLock")).toEqual([["pessimistic_write"]])
        expect(em.exists).toHaveBeenCalledWith(BookingWaitlistEntity, {
            where: [
                { ...WINDOW, conversationId: "conversation-1" },
                { ...WINDOW, leadId: "lead-1" },
            ],
        })
        expect(em.insert).toHaveBeenCalledWith(BookingWaitlistEntity, savedOf())
    })

    it("answers false when the customer is already waiting for that service window", async () => {
        const { em } = joining(true)
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf())).resolves.toBe(false)

        expect(em.insert).not.toHaveBeenCalled()
    })

    it("preserves absent customer links and phone in the waitlist entry", async () => {
        const { em } = joining(false)
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf({ leadId: null, conversationId: null, customerPhone: null }))).resolves.toBe(
            true,
        )

        expect(em.exists).not.toHaveBeenCalled()
        expect(em.insert).toHaveBeenCalledWith(
            BookingWaitlistEntity,
            savedOf({ leadId: null, conversationId: null, customerPhone: null }),
        )
    })
})
describe("BookingWaitlistService join", () => {
    it("trims the customer name and note before limiting their lengths", async () => {
        const { em } = joining(false)
        const waitlist = await build(em)

        await expect(
            waitlist.join(entryOf({ customerName: `  ${"N".repeat(121)}  `, note: `  ${"n".repeat(401)}  ` })),
        ).resolves.toBe(true)

        expect(em.insert).toHaveBeenCalledWith(
            BookingWaitlistEntity,
            savedOf({ customerName: "N".repeat(120), note: "n".repeat(400) }),
        )
    })

    it.each([
        { supplied: -3, saved: 1 },
        { supplied: 0, saved: 1 },
        { supplied: 1.49, saved: 1 },
        { supplied: 1.5, saved: 2 },
        { supplied: 200.49, saved: 200 },
        { supplied: 201, saved: 200 },
    ])("rounds and clamps a party of $supplied to $saved", async ({ supplied, saved }) => {
        const { em } = joining(false)
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf({ partySize: supplied }))).resolves.toBe(true)

        expect(em.insert).toHaveBeenCalledWith(BookingWaitlistEntity, savedOf({ partySize: saved }))
    })
})
