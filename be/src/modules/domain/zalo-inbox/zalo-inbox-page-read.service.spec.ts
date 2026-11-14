import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AccountDataReadService } from "@modules/domain/account-data"
import type { StoredRow } from "@modules/domain/account-data"
import { ZaloInboxPageReadService } from "./zalo-inbox-page-read.service"

const CONNECTION = "0b1d52a4-8f3e-4c8a-9a64-4f0d2f6e7a11"

/** A stored row of the given type, occurred at the given time. */
const rowAt = (type: string, at: string): StoredRow => ({
    id: `${type}-1`,
    type,
    typeVersion: 1,
    key: "k-1",
    value: {},
    occurredAt: new Date(at),
    processedAt: null,
})

const build = async (newest: Readonly<Record<string, ReadonlyArray<StoredRow>>>, follower: StoredRow | null = null) => {
    const reads = mock<AccountDataReadService>()
    reads.newest.mockImplementation((_connection, type) => Promise.resolve([...(newest[type] ?? [])]))
    reads.newestWhere.mockResolvedValue(follower)
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloInboxPageReadService, { provide: AccountDataReadService, useValue: reads }],
    }).compile()
    return { service: moduleRef.get(ZaloInboxPageReadService), reads }
}

describe("ZaloInboxPageReadService", () => {
    it("answers null when the account keeps no event, message or follower", async () => {
        const { service } = await build({})
        await expect(service.factsOf(CONNECTION)).resolves.toBeNull()
    })

    it("reads the last time as the newer of the newest event and message, a kept message as a text seen", async () => {
        const { service, reads } = await build({
            "zalo_oa.event": [rowAt("zalo_oa.event", "2026-11-12T08:00:00.000Z")],
            "zalo_oa.message": [rowAt("zalo_oa.message", "2026-11-12T09:00:00.000Z")],
        })
        await expect(service.factsOf(CONNECTION)).resolves.toEqual({
            last_at: "2026-11-12T09:00:00.000Z",
            has_text: true,
            has_follow: false,
        })
        expect(reads.newest).toHaveBeenCalledWith(CONNECTION, "zalo_oa.event", 1)
        expect(reads.newest).toHaveBeenCalledWith(CONNECTION, "zalo_oa.message", 1)
    })

    it("reads a follow as a kept person who follows, through the declared followed index", async () => {
        const follower = rowAt("zalo_oa.user", "2026-11-12T07:00:00.000Z")
        const { service, reads } = await build(
            { "zalo_oa.event": [rowAt("zalo_oa.event", "2026-11-12T08:00:00.000Z")] },
            follower,
        )
        await expect(service.factsOf(CONNECTION)).resolves.toEqual({
            last_at: "2026-11-12T08:00:00.000Z",
            has_text: false,
            has_follow: true,
        })
        expect(reads.newestWhere).toHaveBeenCalledWith(CONNECTION, "zalo_oa.user", "followed", "true")
    })

    it("names the people who wrote after a moment from the stored inbound messages: newest first, one per person, outgoing and older lines left out", async () => {
        const said = (userId: string, direction: string, at: string): StoredRow => ({ ...rowAt("zalo_oa.message", at), value: { userId, direction } })
        const { service, reads } = await build({
            "zalo_oa.message": [
                said("u-2", "in", "2026-11-12T09:30:00.000Z"),
                said("u-1", "out", "2026-11-12T09:20:00.000Z"),
                said("u-1", "in", "2026-11-12T09:00:00.000Z"),
                said("u-2", "in", "2026-11-12T08:00:00.000Z"),
                said("u-3", "in", "2026-11-10T08:00:00.000Z"),
            ],
        })
        reads.get.mockImplementation((_connection, _type, key) =>
            Promise.resolve(key === "u-1" ? { ...rowAt("zalo_oa.user", "2026-11-12T00:00:00.000Z"), value: { name: "An" } } : null),
        )

        await expect(service.writersSince(CONNECTION, new Date("2026-11-11T00:00:00.000Z"), 40)).resolves.toEqual([
            { userId: "u-2", name: "", lastAt: "2026-11-12T09:30:00.000Z" },
            { userId: "u-1", name: "An", lastAt: "2026-11-12T09:00:00.000Z" },
        ])
        await expect(service.writersSince(CONNECTION, new Date("2026-11-11T00:00:00.000Z"), 1)).resolves.toHaveLength(1)
    })
})
