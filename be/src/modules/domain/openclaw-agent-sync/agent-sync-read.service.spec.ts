import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentSyncReadService } from "./agent-sync-read.service"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

const CHECKED_AT = new Date("2026-10-12T10:00:00.000Z")

const build = async (entityManager: MockEntityManager) =>
    (
        await Test.createTestingModule({
            providers: [AgentSyncReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
        }).compile()
    ).get(AgentSyncReadService)

describe("AgentSyncReadService", () => {
    it("answers where the copy of an installation stands", async () => {
        const row = Object.assign(new OpenclawAgentSyncEntity(), {
            status: "error",
            contextVersion: 3,
            checkedAt: CHECKED_AT,
            error: "gateway down",
            agentId: "ignored",
        })
        const em = mockEntityManager({ findOne: [OpenclawAgentSyncEntity, row] })

        await expect((await build(em)).copyOf("inst-1")).resolves.toEqual({
            status: "error",
            contextVersion: 3,
            checkedAt: CHECKED_AT,
            error: "gateway down",
        })
        expect(em.findOne).toHaveBeenCalledWith(OpenclawAgentSyncEntity, {
            select: { status: true, contextVersion: true, checkedAt: true, error: true },
            where: { installationId: "inst-1" },
        })
    })

    it("answers nothing for an installation without a copy", async () => {
        const em = mockEntityManager({ findOne: [OpenclawAgentSyncEntity, null] })

        await expect((await build(em)).copyOf("inst-1")).resolves.toBeNull()
    })
})
