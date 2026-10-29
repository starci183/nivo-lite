import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InstallationChangesService } from "./installation-changes.service"

const CHANGE = { workspaceId: "ws-1", installationId: "inst-1", force: true }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const bus = mock<EventBus>()
    bus.publish.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            InstallationChangesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: EVENT_BUS, useValue: bus },
        ],
    }).compile()
    return { service: moduleRef.get(InstallationChangesService), tx, bus }
}

describe("InstallationChangesService", () => {
    it("publishes installation_changed in the caller's transaction with a fresh dedupe key per change", async () => {
        const { service, tx, bus } = await build()

        await service.announce(CHANGE, tx.em)
        await service.announce(CHANGE, tx.em)

        expect(bus.publish).toHaveBeenCalledTimes(2)
        const [first, second] = bus.publish.mock.calls.map(([event]) => event)
        expect(first).toMatchObject({ eventName: "installation_changed", payload: CHANGE })
        expect(first?.payload.dedupeKey).not.toBe(second?.payload.dedupeKey)
        expect(bus.publish.mock.calls[0]?.[1]).toBe(tx.em)
        expect(bus.publish.mock.calls[0]?.[2]).toBe(first?.eventId)
    })

    it("publishes in a transaction of its own for a change whose write another capability committed", async () => {
        const { service, tx, bus } = await build()

        await service.announceNow({ ...CHANGE, installationId: null, force: false })

        expect(tx.commits).toBe(1)
        expect(bus.publish).toHaveBeenCalledWith(
            expect.objectContaining({ payload: expect.objectContaining({ installationId: null, force: false }) }),
            expect.anything(),
            expect.any(String),
        )
    })

    it("leaves a failed publish to undo the change", async () => {
        const { service, tx, bus } = await build()
        const cause = new Error("bus down")
        bus.publish.mockRejectedValue(cause)

        await expect(service.announce(CHANGE, tx.em)).rejects.toBe(cause)
    })
})
