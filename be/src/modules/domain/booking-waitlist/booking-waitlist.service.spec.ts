import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingWaitlistService } from "./booking-waitlist.service"
import type { WaitlistEntry } from "./booking-waitlist.contracts"
import { CANCEL_SETUP_WAITLIST, JOIN_WAITLIST } from "./persistence/booking-waitlist.sql"

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

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingWaitlistService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingWaitlistService)
}

describe("BookingWaitlistService cancel", () => {
    it("cancels an entry of the workspace and answers its id", async () => {
        const em = mockEntityManager({ query: [CANCEL_SETUP_WAITLIST, [{ id: "w-1" }]] })
        const waitlist = await build(em)

        await expect(waitlist.cancel("ws-1", "w-1")).resolves.toEqual([{ id: "w-1" }])
        expect(em.query).toHaveBeenCalledWith(CANCEL_SETUP_WAITLIST, ["ws-1", "w-1"])
    })

    it("answers nothing for an entry of another workspace, through the caller's manager", async () => {
        const own = mockEntityManager()
        const caller = mockEntityManager({ query: [CANCEL_SETUP_WAITLIST, []] })
        const waitlist = await build(own)

        await expect(waitlist.cancel("ws-1", "w-9", caller)).resolves.toEqual([])
        expect(own.query).not.toHaveBeenCalled()
    })
})
describe("BookingWaitlistService join", () => {
    it("joins a customer to the service window and answers true when an entry was added", async () => {
        const em = mockEntityManager({ query: [JOIN_WAITLIST, [{ id: "w-1" }]] })
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf())).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(JOIN_WAITLIST, [
            "ws-1",
            "lead-1",
            "conversation-1",
            "Mai",
            "84912345678",
            "service-1",
            "2026-10-15T02:00:00.000Z",
            "2026-10-15T11:00:00.000Z",
            2,
            "afternoon preferred",
        ])
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("answers false when the customer is already waiting for that service window", async () => {
        const em = mockEntityManager({ query: [JOIN_WAITLIST, []] })
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf())).resolves.toBe(false)

        expect(em.query).toHaveBeenCalledWith(JOIN_WAITLIST, [
            "ws-1",
            "lead-1",
            "conversation-1",
            "Mai",
            "84912345678",
            "service-1",
            "2026-10-15T02:00:00.000Z",
            "2026-10-15T11:00:00.000Z",
            2,
            "afternoon preferred",
        ])
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("preserves absent customer links and phone in the waitlist entry", async () => {
        const em = mockEntityManager({ query: [JOIN_WAITLIST, [{ id: "w-1" }]] })
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf({ leadId: null, conversationId: null, customerPhone: null }))).resolves.toBe(
            true,
        )

        expect(em.query).toHaveBeenCalledWith(JOIN_WAITLIST, [
            "ws-1",
            null,
            null,
            "Mai",
            null,
            "service-1",
            "2026-10-15T02:00:00.000Z",
            "2026-10-15T11:00:00.000Z",
            2,
            "afternoon preferred",
        ])
    })
})
describe("BookingWaitlistService join", () => {
    it("trims the customer name and note before limiting their lengths", async () => {
        const em = mockEntityManager({ query: [JOIN_WAITLIST, [{ id: "w-1" }]] })
        const waitlist = await build(em)

        await expect(
            waitlist.join(entryOf({ customerName: `  ${"N".repeat(121)}  `, note: `  ${"n".repeat(401)}  ` })),
        ).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(JOIN_WAITLIST, [
            "ws-1",
            "lead-1",
            "conversation-1",
            "N".repeat(120),
            "84912345678",
            "service-1",
            "2026-10-15T02:00:00.000Z",
            "2026-10-15T11:00:00.000Z",
            2,
            "n".repeat(400),
        ])
    })

    it.each([
        { supplied: -3, saved: 1 },
        { supplied: 0, saved: 1 },
        { supplied: 1.49, saved: 1 },
        { supplied: 1.5, saved: 2 },
        { supplied: 200.49, saved: 200 },
        { supplied: 201, saved: 200 },
    ])("rounds and clamps a party of $supplied to $saved", async ({ supplied, saved }) => {
        const em = mockEntityManager({ query: [JOIN_WAITLIST, [{ id: "w-1" }]] })
        const waitlist = await build(em)

        await expect(waitlist.join(entryOf({ partySize: supplied }))).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(JOIN_WAITLIST, [
            "ws-1",
            "lead-1",
            "conversation-1",
            "Mai",
            "84912345678",
            "service-1",
            "2026-10-15T02:00:00.000Z",
            "2026-10-15T11:00:00.000Z",
            saved,
            "afternoon preferred",
        ])
    })
})
