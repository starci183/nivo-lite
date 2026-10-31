import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { And, LessThan, MoreThanOrEqual } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ContentEngagementDailyService } from "./content-engagement-daily.service"
import { ContentEngagementDailyEntity } from "./persistence/entities"

/** The rows of one upsert with their sync stamp, a function expression, run to the SQL it yields. */
const stamped = (rows: unknown): ReadonlyArray<unknown> =>
    Array.isArray(rows) ? rows.map((row: unknown) => evaluatedValues(row)) : []

/** What each upsert wrote: the entity, the stamped rows, and the conflict keys. */
const upsertsOf = (em: MockEntityManager) =>
    em.upsert.mock.calls.map(([target, rows, keys]) => [target, stamped(rows), keys])

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentEngagementDailyService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ContentEngagementDailyService)
}

describe("ContentEngagementDailyService", () => {
    it("upserts the reported days in one statement, stamping the sync time", async () => {
        const em = mockEntityManager({ upsert: [ContentEngagementDailyEntity, {}] })
        const service = await build(em)
        const days = [{ day: "2026-10-12", reach: 100, engagements: 10 }]

        await expect(service.upsert("ws-1", "facebook", days)).resolves.toBe(1)
        expect(upsertsOf(em)).toEqual([
            [
                ContentEngagementDailyEntity,
                [
                    {
                        workspaceId: "ws-1",
                        channel: "facebook",
                        day: "2026-10-12",
                        reach: 100,
                        engagements: 10,
                        syncedAt: "now()",
                    },
                ],
                ["workspaceId", "channel", "day"],
            ],
        ])
    })

    it("writes nothing for no days", async () => {
        const service = await build(mockEntityManager())

        await expect(service.upsert("ws-1", "facebook", [])).resolves.toBe(0)
    })

    it("upserts the new customer messages of the days in one statement, and nothing for no days", async () => {
        const em = mockEntityManager({ upsert: [ContentEngagementDailyEntity, {}] })
        const service = await build(em)
        const days = [{ channel: "zalo", day: "2026-10-12", messages: 3 }]

        await expect(service.upsertMessages("ws-1", days)).resolves.toBe(1)
        await expect(service.upsertMessages("ws-1", [])).resolves.toBe(0)
        expect(em.upsert).toHaveBeenCalledTimes(1)
        expect(upsertsOf(em)).toEqual([
            [
                ContentEngagementDailyEntity,
                [{ workspaceId: "ws-1", channel: "zalo", day: "2026-10-12", messages: 3, syncedAt: "now()" }],
                ["workspaceId", "channel", "day"],
            ],
        ])
    })

    it("lists the rows between two days", async () => {
        const rows: Array<ContentEngagementDailyEntity> = [
            {
                workspaceId: "ws-1",
                channel: "facebook",
                day: "2026-10-12",
                reach: 1,
                engagements: 2,
                messages: 0,
                syncedAt: new Date("2026-10-13T00:00:00.000Z"),
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
        ]
        const em = mockEntityManager({ find: [ContentEngagementDailyEntity, rows] })
        const service = await build(em)

        await expect(service.between("ws-1", "2026-10-05", "2026-10-19")).resolves.toEqual([
            { channel: "facebook", day: "2026-10-12", reach: 1, engagements: 2, messages: 0 },
        ])
        expect(em.find).toHaveBeenCalledWith(ContentEngagementDailyEntity, {
            where: { workspaceId: "ws-1", day: And(MoreThanOrEqual("2026-10-05"), LessThan("2026-10-19")) },
            order: { day: "ASC", channel: "ASC" },
            take: 400,
        })
    })
})
