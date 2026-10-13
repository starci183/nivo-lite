import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import type { MembershipRow } from "./persistence/workspaces.rows"
import { INSERT_FREE_WORKSPACE, LIST_MEMBERSHIPS } from "./persistence/workspaces.sql"
import type { WorkspacesOptions } from "./workspaces.options"
import { WORKSPACES_OPTIONS } from "./workspaces.port"
import { WorkspacesService } from "./workspaces.service"

const rowOf = builder<MembershipRow>({
    workspace_id: "ws-1",
    user_id: "user-1",
    role: "manager",
    staff_id: null,
    display_name: "An",
    status: "active",
    workspace_name: "Quan Ca Phe",
    workspace_status: "active",
    owner_id: "owner-1",
    workspace_created_at: "2026-10-01T00:00:00.000Z",
    business_type: "cafe",
})

const build = async (entityManager: MockEntityManager, overrides?: Partial<WorkspacesOptions>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspacesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            {
                provide: WORKSPACES_OPTIONS,
                useValue: builder<WorkspacesOptions>({ allowFreeWorkspace: false })(overrides),
            },
        ],
    }).compile()
    return moduleRef.get(WorkspacesService)
}

describe("WorkspacesService", () => {
    describe("memberships", () => {
        it("maps each membership with its workspace", async () => {
            const em = mockEntityManager({ query: [LIST_MEMBERSHIPS, [rowOf()]] })

            await expect((await build(em)).memberships("user-1")).resolves.toEqual([
                {
                    member: {
                        userId: "user-1",
                        workspaceId: "ws-1",
                        role: "manager",
                        staffId: null,
                        displayName: "An",
                        status: "active",
                    },
                    workspace: {
                        id: "ws-1",
                        name: "Quan Ca Phe",
                        status: "active",
                        ownerId: "owner-1",
                        createdAt: "2026-10-01T00:00:00.000Z",
                        businessType: "cafe",
                    },
                },
            ])
            expect(em.query).toHaveBeenCalledWith(LIST_MEMBERSHIPS, ["user-1"])
        })
    })

    describe("createFree", () => {
        it("creates an active workspace owned by the person where signup is allowed", async () => {
            const em = mockEntityManager({ query: [INSERT_FREE_WORKSPACE, [{ id: "ws-new" }]] })
            const service = await build(em, { allowFreeWorkspace: true })

            await expect(service.createFree("user-1", "NIVO Workspace")).resolves.toEqual({ id: "ws-new" })
            expect(em.query).toHaveBeenCalledWith(INSERT_FREE_WORKSPACE, ["user-1", "NIVO Workspace"])
        })

        it("refuses where signup is switched off", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).createFree("user-1", "NIVO Workspace")).rejects.toMatchObject({
                code: WorkspacesErrorCode.SignupDisabled,
            })
            expect(em.query).not.toHaveBeenCalled()
        })
    })
})
