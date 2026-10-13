import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { INSERT_AUDIT, LIST_RECENT_AUDITS } from "./persistence/platform-audit.sql"
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
        const em = mockEntityManager({ query: [INSERT_AUDIT, []] })

        await (await build(em)).audit.record(entry)

        expect(em.query).toHaveBeenCalledWith(INSERT_AUDIT, [
            "team@nivo.vn",
            "u-1",
            "view.workspace",
            "ws-1",
            '{"a":1}',
        ])
    })

    it("logs instead of failing when the row cannot be written", async () => {
        const em = mockEntityManager({ query: [INSERT_AUDIT, []] })
        const failure = new Error("audit table missing")
        em.query.mockRejectedValueOnce(failure)
        const { audit, logger } = await build(em)

        await expect(audit.record(entry)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith("platform_audit.write_failed", failure, {
            action: "view.workspace",
        })
    })

    it("lists the newest rows with ISO instants", async () => {
        const em = mockEntityManager({
            query: [
                LIST_RECENT_AUDITS,
                [
                    {
                        id: "a-1",
                        actor_email: "team@nivo.vn",
                        action: "view.health",
                        workspace_id: null,
                        created_at: "2026-10-11 08:00:00+00",
                    },
                ],
            ],
        })

        await expect((await build(em)).audit.recent()).resolves.toEqual([
            {
                id: "a-1",
                actorEmail: "team@nivo.vn",
                action: "view.health",
                workspaceId: null,
                createdAt: "2026-10-11T08:00:00.000Z",
            },
        ])
    })
})
