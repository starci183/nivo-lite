import { Test } from "@nestjs/testing"
import { IsNull, MoreThan } from "typeorm"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { DECLINED_INVITE_ROW, MY_INVITE_ROWS, myInviteRow } from "@tests/fixtures/builders/my-invites.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { EventsService } from "@modules/domain/events"
import { WorkspaceAdminReadService } from "@modules/domain/workspaces"
import { ACCOUNT_DIRECTORY, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { MyInvitesService } from "./my-invites.service"
import { WorkspaceInviteEntity } from "./persistence/entities"
import { WorkspaceInvitesService } from "./workspace-invites.service"

const NOW = new Date("2026-11-09T08:00:00.000Z")

const ME = { id: "user-2", email: " An@Example.test " }

const build = async (entityManager: MockEntityManager) => {
    const accounts = mock<AccountDirectory>()
    accounts.accountOf.mockResolvedValue(ok({ email: "vy@example.test", lastSignInAt: null, displayName: "Ha Vy" }))
    const workspaces = mock<WorkspaceAdminReadService>()
    workspaces.namesOf.mockResolvedValue([{ id: "ws-1", name: "Ca phe Hat Nau" }])
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const members = mock<WorkspaceMembersService>()
    const invites = mock<WorkspaceInvitesService>()
    invites.acceptById.mockResolvedValue({ workspaceId: "ws-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MyInvitesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
            { provide: WorkspaceAdminReadService, useValue: workspaces },
            { provide: EventsService, useValue: events },
            { provide: WorkspaceInvitesService, useValue: invites },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(MyInvitesService), accounts, workspaces, events, invites, members }
}

describe("MyInvitesService > listMine", () => {
    it("lists the pending invitations to the signed-in address with their workspace and inviter", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [
            {
                getMany: MY_INVITE_ROWS,
            },
        ])
        const { service, accounts, workspaces } = await build(em)

        await expect(service.listMine(ME)).resolves.toEqual([
            {
                id: "invite-1",
                workspaceId: "ws-1",
                workspaceName: "Ca phe Hat Nau",
                role: "staff",
                invitedByName: "Ha Vy",
                expiresAt: "2026-11-15T08:00:00.000Z",
            },
            {
                id: "invite-2",
                workspaceId: "ws-1",
                workspaceName: "Ca phe Hat Nau",
                role: "staff",
                invitedByName: null,
                expiresAt: "2026-11-15T08:00:00.000Z",
            },
        ])
        expect(read?.callsOf("where")).toEqual([
            [
                "lower(i.email) = :email AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.declined_at IS NULL AND i.expires_at > :now",
                { email: "an@example.test", now: NOW },
            ],
        ])
        expect(read?.callsOf("limit")).toEqual([[50]])
        expect(workspaces.namesOf).toHaveBeenCalledWith(["ws-1", "ws-gone"], 50)
        expect(accounts.accountOf).toHaveBeenCalledTimes(1)
    })

    it("names no inviter the directory does not know", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [myInviteRow()] }])
        const { service, accounts } = await build(em)
        accounts.accountOf.mockResolvedValue(refused("ACCOUNT_NOT_FOUND"))

        await expect(service.listMine(ME)).resolves.toMatchObject([{ invitedByName: null }])
    })

    it("reads no workspace when nothing is pending", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [] }])
        const { service, workspaces } = await build(em)

        await expect(service.listMine(ME)).resolves.toEqual([])
        expect(workspaces.namesOf).not.toHaveBeenCalled()
    })

    it("lists nothing for a session without an address", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.listMine({ id: "user-2" })).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("MyInvitesService > decline", () => {
    it("revokes the pending invitation to the signed-in address and records it", async () => {
        const em = mockEntityManager()
        const [write] = queueQueryBuilders(em, [
            { execute: { raw: [{ id: "invite-1", email: "an@example.test", role: "staff", workspace_id: "ws-1" }] } },
        ])
        const { service, events } = await build(em)

        await service.decline(ME, "invite-1")

        expect(write?.callsOf("set")).toEqual([[{ declinedAt: NOW, declinedBy: "user-2" }]])
        expect(write?.callsOf("where")).toEqual([
            [
                "id = :inviteId AND lower(email) = :email AND accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL",
                { inviteId: "invite-1", email: "an@example.test" },
            ],
        ])
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.invite_declined",
            actor: "an@example.test",
            summary: "an@example.test",
        })
    })

    it("refuses an invitation that is not pending for this address", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const { service, events } = await build(em)

        await expect(service.decline(ME, "invite-9")).rejects.toMatchObject({
            code: WorkspaceInvitesErrorCode.NotFound,
        })
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses a session without an address before any write", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.decline({ id: "user-2" }, "invite-1")).rejects.toMatchObject({
            code: WorkspaceInvitesErrorCode.NotFound,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("MyInvitesService > revokeAllOf", () => {
    it("revokes every pending invitation of the workspace", async () => {
        const em = mockEntityManager()
        const [write] = queueQueryBuilders(em, [{ execute: { affected: 2 } }])
        const { service } = await build(em)

        await service.revokeAllOf("ws-1")

        expect(write?.callsOf("set")).toEqual([[{ revokedAt: NOW }]])
        expect(write?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL",
                { workspaceId: "ws-1" },
            ],
        ])
    })
})

describe("MyInvitesService > join", () => {
    it("accepts the invitation the id names, as the link does", async () => {
        const { service, invites } = await build(mockEntityManager())

        await expect(service.join(ME, "invite-1")).resolves.toEqual({ workspaceId: "ws-1" })
        expect(invites.acceptById).toHaveBeenCalledWith(ME, "invite-1")
    })
})

describe("MyInvitesService > listDeclined", () => {
    it("lists the invitations declined in the last 30 days, newest first, for an owner or manager", async () => {
        const em = mockEntityManager({ find: [WorkspaceInviteEntity, [DECLINED_INVITE_ROW]] })
        const { service, members } = await build(em)

        await expect(service.listDeclined("owner-1", "ws-1")).resolves.toEqual([
            { id: "invite-1", email: "an@example.test", role: "staff", declinedAt: "2026-11-08T08:00:00.000Z" },
        ])
        expect(members.require).toHaveBeenCalledWith("owner-1", "ws-1", ["owner", "manager"])
        expect(em.find).toHaveBeenCalledWith(WorkspaceInviteEntity, {
            select: { id: true, email: true, role: true, declinedAt: true },
            where: {
                workspaceId: "ws-1",
                acceptedAt: IsNull(),
                revokedAt: IsNull(),
                declinedAt: MoreThan(new Date("2026-10-10T08:00:00.000Z")),
            },
            order: { declinedAt: "DESC" },
            take: 50,
        })
    })
})
