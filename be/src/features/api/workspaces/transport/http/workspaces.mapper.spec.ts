import { builder } from "@starci/jest-preset"
import type { PendingInvite } from "@modules/domain/workspace-invites"
import type { MemberListing, WorkspaceMember } from "@modules/domain/workspace-members"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import {
    toAcceptInviteResponse,
    toCreateInviteRequest,
    toCreateWorkspaceResponse,
    toInvitePreviewResponse,
    toInviteResultResponse,
    toInvitesResponse,
    toMembersResponse,
    toMembershipsResponse,
} from "./workspaces.mapper"

const workspaceOf = builder<WorkspaceMembership["workspace"]>({
    id: "workspace-1",
    name: "Cafe",
    status: "active",
    ownerId: "owner-1",
    createdAt: "2026-10-13T10:00:00.000Z",
    businessType: null,
})

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "workspace-1",
    role: "staff",
    staffId: "staff-1",
    displayName: "An",
    status: "active",
})

const listingOf = builder<MemberListing>({
    ...memberOf(),
    email: "an@example.test",
    lastSignInAt: null,
})

const inviteOf = builder<PendingInvite>({
    id: "invite-1",
    email: "an@example.test",
    role: "staff",
    staffId: null,
    createdAt: "2026-10-13T10:00:00.000Z",
    expiresAt: "2026-10-20T10:00:00.000Z",
})

describe("workspaces mapper", () => {
    it("copies the workspace and member fields into separate response objects", () => {
        const membership: WorkspaceMembership = { workspace: workspaceOf(), member: memberOf() }
        const result = toMembershipsResponse([membership])

        expect(result).toEqual([
            {
                workspace: {
                    id: "workspace-1",
                    name: "Cafe",
                    status: "active",
                    ownerId: "owner-1",
                    createdAt: "2026-10-13T10:00:00.000Z",
                    businessType: null,
                },
                member: {
                    userId: "user-1",
                    workspaceId: "workspace-1",
                    role: "staff",
                    staffId: "staff-1",
                    displayName: "An",
                    status: "active",
                },
            },
        ])
        expect(result[0]?.workspace).not.toBe(membership.workspace)
        expect(result[0]?.member).not.toBe(membership.member)
    })

    it("copies every member listing field without changing nullable values", () => {
        const member = listingOf()
        const result = toMembersResponse([member])

        expect(result).toEqual([
            {
                userId: "user-1",
                workspaceId: "workspace-1",
                role: "staff",
                staffId: "staff-1",
                displayName: "An",
                status: "active",
                email: "an@example.test",
                lastSignInAt: null,
            },
        ])
        expect(result[0]).not.toBe(member)
    })

    it("copies every pending invitation field", () => {
        const invite = inviteOf()
        const result = toInvitesResponse([invite])

        expect(result).toEqual([
            {
                id: "invite-1",
                email: "an@example.test",
                role: "staff",
                staffId: null,
                createdAt: "2026-10-13T10:00:00.000Z",
                expiresAt: "2026-10-20T10:00:00.000Z",
            },
        ])
        expect(result[0]).not.toBe(invite)
    })

    it("answers empty lists when there are no memberships, members or invitations", () => {
        expect(toMembershipsResponse([])).toEqual([])
        expect(toMembersResponse([])).toEqual([])
        expect(toInvitesResponse([])).toEqual([])
    })

    it("answers the created workspace id", () => {
        expect(toCreateWorkspaceResponse({ id: "workspace-1" })).toEqual({ id: "workspace-1" })
    })

    it("copies the invitation fields and adds the selected workspace", () => {
        expect(
            toCreateInviteRequest("workspace-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
        ).toEqual({
            workspaceId: "workspace-1",
            email: "an@example.test",
            role: "staff",
            staffId: "staff-1",
        })
        expect(toCreateInviteRequest("workspace-2", { email: "manager@example.test", role: "manager" })).toEqual({
            workspaceId: "workspace-2",
            email: "manager@example.test",
            role: "manager",
            staffId: undefined,
        })
    })

    it("answers the exact address, acceptance link and delivery result", () => {
        expect(
            toInviteResultResponse({
                email: "an@example.test",
                link: "https://app.test/invite/token-1",
                delivery: "existing",
            }),
        ).toEqual({
            email: "an@example.test",
            link: "https://app.test/invite/token-1",
            delivery: "existing",
        })
    })

    it("answers the invitation preview, including its nullable staff name and state", () => {
        expect(
            toInvitePreviewResponse({
                workspaceName: "Cafe",
                email: "an@example.test",
                role: "manager",
                staffName: null,
                state: "expired",
            }),
        ).toEqual({
            workspaceName: "Cafe",
            email: "an@example.test",
            role: "manager",
            staffName: null,
            state: "expired",
        })
    })

    it("answers the workspace joined by accepting the invitation", () => {
        expect(toAcceptInviteResponse({ workspaceId: "workspace-1" })).toEqual({ workspaceId: "workspace-1" })
    })
})
