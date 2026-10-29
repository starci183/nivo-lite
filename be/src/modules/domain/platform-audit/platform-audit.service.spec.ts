import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Not } from "typeorm"
import { PlatformAuditEntity } from "./persistence/entities"
import { PlatformAuditService } from "./platform-audit.service"

const build = async (em: MockEntityManager) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PlatformAuditService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { audit: moduleRef.get(PlatformAuditService), logger }
}

const entry = {
    actorId: "u-1",
    actorEmail: "team@nivo.vn",
    action: "view.workspace",
    workspaceId: "ws-1",
    data: { a: 1 },
}

describe("PlatformAuditService", () => {
    it("writes one audit row", async () => {
        const em = mockEntityManager({ insert: [PlatformAuditEntity, {}] })

        await (await build(em)).audit.record(entry)

        expect(em.insert).toHaveBeenCalledWith(PlatformAuditEntity, {
            actorEmail: "team@nivo.vn",
            actorId: "u-1",
            action: "view.workspace",
            workspaceId: "ws-1",
            data: { a: 1 },
        })
    })

    it("logs instead of failing when the row cannot be written", async () => {
        const em = mockEntityManager()
        const failure = new Error("audit table missing")
        em.insert.mockRejectedValueOnce(failure)
        const { audit, logger } = await build(em)

        await expect(audit.record(entry)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith("platform_audit.write_failed", failure, {
            action: "view.workspace",
        })
    })

    it("lists the newest rows with ISO instants", async () => {
        const row = Object.assign(new PlatformAuditEntity(), {
            id: "a-1",
            actorEmail: "team@nivo.vn",
            action: "view.workspace",
            workspaceId: null,
            createdAt: new Date("2026-10-11T08:00:00.000Z"),
        })
        const em = mockEntityManager({ find: [PlatformAuditEntity, [row]] })

        await expect((await build(em)).audit.recent()).resolves.toEqual([
            {
                id: "a-1",
                actorEmail: "team@nivo.vn",
                action: "view.workspace",
                workspaceId: null,
                createdAt: "2026-10-11T08:00:00.000Z",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(PlatformAuditEntity, {
            select: { id: true, actorEmail: true, action: true, workspaceId: true, createdAt: true },
            where: { action: Not("view.health") },
            order: { createdAt: "DESC" },
            take: 15,
        })
    })
})
