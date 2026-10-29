import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceInviteEntity } from "./persistence/entities"
import { WorkspaceInvitesAdminReadService } from "./workspace-invites-admin-read.service"

const WHEN = new Date("2026-10-02T00:00:00.000Z")
const LATER = new Date("2026-10-09T00:00:00.000Z")

describe("WorkspaceInvitesAdminReadService", () => {
    it("lists the invitations neither accepted nor revoked, newest first, bounded", async () => {
        const invite = Object.assign(new WorkspaceInviteEntity(), {
            id: "iv-1",
            email: "a@b.c",
            role: "staff",
            createdAt: WHEN,
            expiresAt: LATER,
        })
        const em = mockEntityManager({ find: [WorkspaceInviteEntity, [invite]] })
        const moduleRef = await Test.createTestingModule({
            providers: [WorkspaceInvitesAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(WorkspaceInvitesAdminReadService).pendingOf("ws-1", 200)).resolves.toEqual([
            { id: "iv-1", email: "a@b.c", role: "staff", createdAt: WHEN, expiresAt: LATER },
        ])
        expect(em.find).toHaveBeenCalledWith(WorkspaceInviteEntity, {
            select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
            where: { workspaceId: "ws-1", acceptedAt: IsNull(), revokedAt: IsNull() },
            order: { createdAt: "DESC" },
            take: 200,
        })
    })
})
