import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuthorityGrantsService } from "./authority-grants.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})

const actionOf = builder<AuthorityActionRecord>({
    action: "give_discount",
    module_key: "sales",
    sort_order: 1,
    default_mode: "ask",
    default_limit_vnd: null,
    default_required_fields: [],
    amount_limit: true,
    max_mode: null,
    label: { vi: "Giam gia", en: "Give a discount" },
})

const DIRECTORY: ReadonlyArray<DirectoryMember> = [
    { memberId: "member-1", name: "Anh Minh", role: "manager", roomId: "sales", status: "active", rooms: ["sales"] },
]

const GRANTS: ReadonlyArray<MemberGrant> = [
    {
        id: "grant-1",
        workspace_id: "ws-1",
        member_id: "member-1",
        action: "give_discount",
        unit: "percent",
        max_amount: 15,
        updated_at: "2026-10-22T09:00:00.000Z",
    },
]

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf())
    const grants = mock<MemberGrantsService>()
    grants.directory.mockResolvedValue(DIRECTORY)
    grants.forAction.mockResolvedValue(GRANTS)
    grants.replaceForAction.mockResolvedValue(GRANTS)
    const actions = mock<AuthorityActionsService>()
    actions.list.mockResolvedValue([actionOf()])
    const evidence = mock<EvidenceService>()
    evidence.log.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthorityGrantsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MemberGrantsService, useValue: grants },
            { provide: AuthorityActionsService, useValue: actions },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(AuthorityGrantsService), members, grants, evidence }
}

describe("AuthorityGrantsService > reads", () => {
    it("lists the people who may be named approvers for an owner or a manager", async () => {
        const { service, members } = await build()

        await expect(service.listApprovers("user-1", "ws-1")).resolves.toEqual(DIRECTORY)

        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
    })

    it("lists the grants of an action for an owner or a manager", async () => {
        const { service, members, grants } = await build()

        await expect(service.listMemberGrants("user-1", "ws-1", "give_discount")).resolves.toEqual(GRANTS)

        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner", "manager"]]])
        expect(grants.forAction.mock.calls).toEqual([["ws-1", "give_discount"]])
    })
})

describe("AuthorityGrantsService > saveMemberGrants", () => {
    const change = [{ memberId: "member-1", maxAmount: 15 }]

    it("saves the grants of an action for the owner alone and logs it", async () => {
        const { service, members, grants, evidence } = await build()

        await expect(service.saveMemberGrants("user-1", "ws-1", "give_discount", change)).resolves.toEqual(GRANTS)

        expect(members.require.mock.calls).toEqual([["user-1", "ws-1", ["owner"]]])
        expect(grants.replaceForAction.mock.calls).toEqual([["ws-1", "give_discount", change]])
        expect(evidence.log.mock.calls).toEqual([
            [
                { workspaceId: "ws-1", actor: "An", locale: "en" },
                { kind: "authority.grants_updated", actor: "An", summary: "give_discount: 1" },
            ],
        ])
    })

    it("refuses a manager the right to hand out approval limits", async () => {
        const { service, members, grants } = await build()
        members.require.mockRejectedValue(new Error("role forbidden"))

        await expect(service.saveMemberGrants("user-2", "ws-1", "give_discount", change)).rejects.toThrow(
            "role forbidden",
        )

        expect(grants.replaceForAction).not.toHaveBeenCalled()
    })

    it("refuses grants for an action outside the registry", async () => {
        const { service, grants } = await build()

        await expect(service.saveMemberGrants("user-1", "ws-1", "launch_rocket", change)).rejects.toMatchObject({
            code: DecisionsErrorCode.UnknownAction,
            params: { action: "launch_rocket" },
        })
        expect(grants.replaceForAction).not.toHaveBeenCalled()
    })
})
