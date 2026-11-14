import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mock } from "@starci/jest-preset"
import { SourceQuotaService } from "@modules/domain/knowledge-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TruthCeilingService } from "./truth-ceiling.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (row: { truths: string; bytes: string } | undefined) => {
    const em = mockEntityManager()
    const quota = mock<SourceQuotaService>()
    const [read] = queueQueryBuilders(em, [{ getRawOne: row }, { getRawOne: row }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            TruthCeilingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: SourceQuotaService, useValue: quota },
        ],
    }).compile()
    return { service: moduleRef.get(TruthCeilingService), read, quota }
}

describe("TruthCeilingService", () => {
    it("counts the truths in force and their bytes in one read of the workspace: active and scheduled only", async () => {
        const { service, read } = await build({ truths: "4990", bytes: "512000" })

        await expect(service.held(WS)).resolves.toEqual({ truths: 4990, bytes: 512_000 })

        // Superseded, rejected, retired and expired versions are not counted.
        expect(read?.callsOf("where")).toEqual([[{ workspaceId: WS, status: In(["active", "scheduled"]) }]])
        expect(read?.callsOf("select")).toEqual([["COUNT(*)", "truths"]])
        expect(read?.callsOf("addSelect")).toEqual([
            [
                "COALESCE(SUM(octet_length(f.subjectLabel) + octet_length(f.attributeLabel) + octet_length(f.value) + COALESCE(octet_length(f.unit), 0)), 0)",
                "bytes",
            ],
        ])
    })

    it("answers the room left under the ceiling", async () => {
        const { service } = await build({ truths: "4990", bytes: "512000" })

        await expect(service.room(WS)).resolves.toEqual({ truths: 10, bytes: 2_097_152 - 512_000 })
    })

    it("answers nothing held, and the whole ceiling as room, for a workspace with no truth", async () => {
        const { service } = await build(undefined)

        await expect(service.held(WS)).resolves.toEqual({ truths: 0, bytes: 0 })
        await expect(service.room(WS)).resolves.toEqual({ truths: 5_000, bytes: 2_097_152 })
    })

    it("answers both allowances of the workspace to a member: a plan's gigabytes are read in megabytes, the bytes capped at a 32-bit integer", async () => {
        const { service, quota } = await build({ truths: "120", bytes: "9000" })
        const area = { usedBytes: 100 * 1024 * 1024, limitBytes: 5 * 1024 * 1024, leftBytes: 0, count: 90 }
        const areas = { public: { ...area, count: 81 }, internal: area }
        quota.usage.mockResolvedValue({
            usedBytes: 200 * 1024 * 1024,
            limitBytes: 10 * 1024 * 1024 * 1024,
            count: 171,
            areas,
        })

        await expect(service.usageOf("u1", WS)).resolves.toEqual({
            usedBytes: 209_715_200,
            limitBytes: 2_147_483_647,
            usedMb: 200,
            limitMb: 10_240,
            truthsInForce: 120,
            truthsCeiling: 5_000,
            truthBytes: 9_000,
            truthBytesCeiling: 2_097_152,
            // The two gauges of the documents tab (drawing brain-limit-50mb, owner 2026-11-11).
            // Each upload area against its own limit (owner 2026-11-12: two areas of 5 MB).
            documents: { usedBytes: 209_715_200, limitBytes: 2_147_483_647, count: 171, areas },
            truths: { count: 120, limitCount: 5_000, usedBytes: 9_000, limitBytes: 2_097_152 },
        })
        expect(quota.usage).toHaveBeenCalledWith("u1", WS)
    })
})
