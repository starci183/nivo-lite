import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MemberRosterService } from "./member-roster.service"
import { WorkspaceMemberEntity } from "./persistence/entities"

const WHEN = new Date("2026-10-02T00:00:00.000Z")

describe("MemberRosterService", () => {
    it("lists the members of a workspace, oldest first, bounded", async () => {
        const member = Object.assign(new WorkspaceMemberEntity(), {
            userId: "u-1",
            role: "owner",
            displayName: "An",
            status: "active",
            createdAt: WHEN,
        })
        const em = mockEntityManager({ find: [WorkspaceMemberEntity, [member]] })
        const moduleRef = await Test.createTestingModule({
            providers: [MemberRosterService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(MemberRosterService).oldestOf("ws-1", 500)).resolves.toEqual([
            { userId: "u-1", role: "owner", displayName: "An", status: "active", createdAt: WHEN },
        ])
        expect(em.find).toHaveBeenCalledWith(WorkspaceMemberEntity, {
            select: { userId: true, role: true, displayName: true, status: true, createdAt: true },
            where: { workspaceId: "ws-1" },
            order: { createdAt: "ASC" },
            take: 500,
        })
    })
})
