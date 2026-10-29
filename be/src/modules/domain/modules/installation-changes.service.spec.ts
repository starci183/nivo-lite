import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { IDS } from "@modules/platform/ids"
import { InstallationChangesService } from "./installation-changes.service"

const CHANGE = { workspaceId: "ws-1", installationId: "inst-1", force: true }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const bus = recordingEventBus()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InstallationChangesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: EVENT_BUS, useValue: bus },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    return { service: moduleRef.get(InstallationChangesService), tx, bus }
}

describe("InstallationChangesService", () => {
    it("publishes installation_changed in the caller's transaction with a fresh dedupe key per change", async () => {
        const { service, tx, bus } = await build()

        await service.announce(CHANGE, tx.em)
        await service.announce(CHANGE, tx.em)

        expect(bus.writes).toHaveLength(2)
        const [first, second] = bus.writes
        expect(first).toMatchObject({ payload: CHANGE })
        expect(first?.eventId).toBe("00000000-0000-4000-8000-000000000001")
        expect(second?.eventId).toBe("00000000-0000-4000-8000-000000000002")
        expect(bus.entries.map((entry) => entry.tx)).toEqual([tx.em, tx.em])
    })

    it("publishes in a transaction of its own for a change whose write another capability committed", async () => {
        const { service, tx, bus } = await build()

        await service.announceNow({ ...CHANGE, installationId: null, force: false })

        expect(tx.commits).toBe(1)
        expect(bus.writes).toMatchObject([{ payload: { force: false } }])
        expect(bus.writes[0]).not.toHaveProperty("payload.installationId")
        expect(bus.allInTransaction).toBe(true)
    })

    it("leaves a failed publish to undo the change", async () => {
        const { service, tx, bus } = await build()
        const cause = new Error("bus down")
        bus.failNext("publish", cause)

        await expect(service.announce(CHANGE, tx.em)).rejects.toBe(cause)
    })
})
