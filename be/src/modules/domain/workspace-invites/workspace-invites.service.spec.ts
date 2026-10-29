import {
    revokedInvitePreview,
    pendingInviteRow,
    pendingInviteExpected,
    NOW,
    TOKEN,
    LINK,
    REDIRECT,
    EXPIRES,
    actorOf,
    listingOf,
    accountOf,
    inviteRowOf,
} from "@tests/fixtures/builders/l2-workspace-invites.builder"
import { fakeQueryBuilder, queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { IsNull, MoreThan } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import { EventsService } from "@modules/domain/events"
import { StaffEntity } from "@modules/domain/staff"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { ACCOUNT_DIRECTORY, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { hashInviteToken } from "./invite-token.policy"
import { WorkspaceInviteEntity } from "./persistence/entities"
import type { InviteDeliveryPort } from "./workspace-invites.contracts"
import { INVITE_DELIVERY, WORKSPACE_INVITES_OPTIONS } from "./workspace-invites.port"
import { WorkspaceInvitesService } from "./workspace-invites.service"

const MINT_UUID = "SELECT * FROM gen_random_uuid()"
/** Two uuids of the database whose joining, dashes removed, is `TOKEN`. */
const MINTED = [
    [MINT_UUID, [{ gen_random_uuid: TOKEN.slice(0, TOKEN.length / 2) }]],
    [MINT_UUID, [{ gen_random_uuid: TOKEN.slice(TOKEN.length / 2) }]],
] as const

const HASH = hashInviteToken(TOKEN)

/** The stored invitation a fixture row describes. */
const storedOf = (row: ReturnType<typeof inviteRowOf>): WorkspaceInviteEntity =>
    Object.assign(new WorkspaceInviteEntity(), {
        id: row.id,
        workspaceId: row.workspace_id,
        email: row.email,
        role: row.role,
        staffId: row.staff_id,
        acceptedAt: row.accepted_at === null ? null : new Date(row.accepted_at),
        revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
        expiresAt: new Date(row.expires_at),
    })

const CHANGED = { id: "invite-1", email: "an@example.test", role: "staff" }

const ROTATE_WHERE = [
    "id = :inviteId AND workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL",
    { inviteId: "invite-1", workspaceId: "ws-1" },
]

const build = async (entityManager: MockEntityManager) => {
    const options = { delivery: "invite-delivery", siteUrl: "https://app.test", inviteDays: 7 }
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(actorOf())
    entityManager.count.mockResolvedValue(0)
    const events = mock<EventsService>()
    const accounts = mock<AccountDirectory>()
    const delivery = mock<InviteDeliveryPort>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceInvitesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WORKSPACE_INVITES_OPTIONS, useValue: options },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
            { provide: INVITE_DELIVERY, useValue: delivery },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: EntitlementsService, useValue: mock<EntitlementsService>() },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceInvitesService), members, events, accounts, delivery }
}

/** A manager that finds the invitation (or none) behind the token, and mints `TOKEN` on request. */
const managerFinding = (row: ReturnType<typeof inviteRowOf> | undefined) =>
    mockEntityManager({
        query: MINTED,
        findOne: [WorkspaceInviteEntity, row === undefined ? null : storedOf(row)],
        update: [WorkspaceInviteEntity, { affected: 1, raw: [], generatedMaps: [] }],
    })

describe("WorkspaceInvitesService listPending", () => {
    it("lists the invitations that can still be accepted", async () => {
        const em = mockEntityManager({
            find: [
                WorkspaceInviteEntity,
                [
                    Object.assign(new WorkspaceInviteEntity(), {
                        id: pendingInviteRow.id,
                        email: pendingInviteRow.email,
                        role: pendingInviteRow.role,
                        staffId: pendingInviteRow.staff_id,
                        createdAt: new Date(pendingInviteRow.created_at),
                        expiresAt: new Date(pendingInviteRow.expires_at),
                    }),
                ],
            ],
        })
        const { service, members } = await build(em)

        await expect(service.listPending("owner-1", "ws-1")).resolves.toEqual(pendingInviteExpected)
        expect(members.require).toHaveBeenCalledWith("owner-1", "ws-1", ["owner", "manager"])
        expect(em.find).toHaveBeenCalledWith(WorkspaceInviteEntity, {
            select: { id: true, email: true, role: true, staffId: true, createdAt: true, expiresAt: true },
            where: {
                workspaceId: "ws-1",
                acceptedAt: IsNull(),
                revokedAt: IsNull(),
                expiresAt: MoreThan(new Date(NOW)),
            },
            order: { createdAt: "DESC" },
            take: 200,
        })
    })

    it("passes on the refusal of the membership check", async () => {
        const em = mockEntityManager({})
        const { service, members } = await build(em)
        members.require.mockRejectedValue(new Error("refused"))

        await expect(service.listPending("user-9", "ws-1")).rejects.toThrow("refused")
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("WorkspaceInvitesService create", () => {
    it("stores the invitation by token hash, emails it and logs the evidence", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: MINTED,
                insert: [WorkspaceInviteEntity, { identifiers: [], generatedMaps: [], raw: [] }],
            }),
        )
        const [revoke] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
        const { service, members, events, delivery } = await build(tx.em)
        members.list.mockResolvedValue([listingOf()])
        delivery.deliverInvite.mockResolvedValue("invited")

        await expect(
            service.create("owner-1", "ws-1", { email: "  An@Example.TEST ", role: "staff" }),
        ).resolves.toEqual({ email: "an@example.test", link: LINK, delivery: "invited" })

        expect(revoke?.callsOf("update")).toEqual([[]])
        expect(revoke?.callsOf("set")).toEqual([[{ revokedAt: new Date(NOW) }]])
        expect(revoke?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND lower(email) = :email AND accepted_at IS NULL AND revoked_at IS NULL",
                { workspaceId: "ws-1", email: "an@example.test" },
            ],
        ])
        expect(tx.em.insert).toHaveBeenCalledWith(WorkspaceInviteEntity, {
            workspaceId: "ws-1",
            email: "an@example.test",
            role: "staff",
            staffId: null,
            tokenHash: HASH,
            invitedBy: "owner-1",
            expiresAt: EXPIRES,
        })
        expect(delivery.deliverInvite).toHaveBeenCalledWith("an@example.test", REDIRECT)
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.invited",
            actor: "Chu",
            summary: "an@example.test · staff",
        })
        expect(tx.commits).toBe(1)
    })
})

describe("WorkspaceInvitesService create", () => {
    it("links a free staff row to the invitation", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: MINTED,
                insert: [WorkspaceInviteEntity, { identifiers: [], generatedMaps: [], raw: [] }],
            }),
        )
        const [held] = queueQueryBuilders(tx.em, [{ getRawOne: undefined }, { execute: { raw: [] } }])
        const { service, members, delivery } = await build(tx.em)
        members.list.mockResolvedValue([listingOf()])
        delivery.deliverInvite.mockResolvedValue("none")

        await expect(
            service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
        ).resolves.toMatchObject({ delivery: "none" })

        expect(held?.callsOf("where")).toEqual([
            ["i.workspace_id = :workspaceId AND i.staff_id = :staffId", { workspaceId: "ws-1", staffId: "staff-1" }],
        ])
        expect(held?.callsOf("andWhere")).toEqual([
            ["i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > :now", { now: new Date(NOW) }],
            ["lower(i.email) <> :email", { email: "an@example.test" }],
        ])
        expect(held?.callsOf("limit")).toEqual([[1]])
        expect(tx.em.insert).toHaveBeenCalledWith(
            WorkspaceInviteEntity,
            expect.objectContaining({ staffId: "staff-1" }),
        )
    })

    it("refuses an address that is not an email", async () => {
        const { service, members } = await build(mockEntityManager({}))

        await expect(service.create("owner-1", "ws-1", { email: "not-an-email", role: "staff" })).rejects.toMatchObject(
            { code: WorkspaceInvitesErrorCode.EmailInvalid },
        )
        expect(members.list).not.toHaveBeenCalled()
    })

    it("refuses an address that already belongs to a member", async () => {
        const { service, members } = await build(mockEntityManager({}))
        members.list.mockResolvedValue([listingOf({ email: "AN@example.test" })])

        await expect(
            service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff" }),
        ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.AlreadyMember })
    })

    it("refuses a staff row that a member already has", async () => {
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ getRawOne: undefined }).builder as never)
        const { service, members } = await build(em)
        members.list.mockResolvedValue([listingOf({ staffId: "staff-1" })])

        await expect(
            service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
        ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.StaffTaken })
    })

    it("refuses a staff row that another pending invitation holds", async () => {
        const em = mockEntityManager()
        em.createQueryBuilder.mockReturnValue(fakeQueryBuilder({ getRawOne: { i_id: "invite-9" } }).builder as never)
        const { service, members } = await build(em)
        members.list.mockResolvedValue([listingOf()])

        await expect(
            service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
        ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.StaffTaken })
    })
})

describe("WorkspaceInvitesService", () => {
    describe("resend", () => {
        it("rotates the link, emails it again and logs the evidence", async () => {
            const em = mockEntityManager({ query: MINTED })
            const [rotate] = queueQueryBuilders(em, [{ execute: { raw: [CHANGED] } }])
            const { service, events, delivery } = await build(em)
            delivery.deliverInvite.mockResolvedValue("existing")

            await expect(service.resend("owner-1", "ws-1", "invite-1")).resolves.toEqual({
                email: "an@example.test",
                link: LINK,
                delivery: "existing",
            })

            expect(rotate?.callsOf("update")).toEqual([[]])
            expect(rotate?.callsOf("set")).toEqual([[{ tokenHash: HASH, expiresAt: EXPIRES }]])
            expect(rotate?.callsOf("where")).toEqual([ROTATE_WHERE])
            expect(rotate?.callsOf("returning")).toEqual([["id, email, role"]])
            expect(delivery.deliverInvite).toHaveBeenCalledWith("an@example.test", REDIRECT)
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: "member.invite_resent",
                actor: "Chu",
                summary: "an@example.test",
            })
        })

        it("answers not found for an invitation that is not pending in this workspace", async () => {
            const em = mockEntityManager({ query: MINTED })
            queueQueryBuilders(em, [{ execute: { raw: [] } }])
            const { service, delivery } = await build(em)

            await expect(service.resend("owner-1", "ws-1", "invite-9")).rejects.toMatchObject({
                code: WorkspaceInvitesErrorCode.NotFound,
            })
            expect(delivery.deliverInvite).not.toHaveBeenCalled()
        })
    })

    describe("copyLink", () => {
        it("issues a fresh link without emailing it", async () => {
            const em = mockEntityManager({ query: MINTED })
            queueQueryBuilders(em, [{ execute: { raw: [CHANGED] } }])
            const { service, delivery } = await build(em)

            await expect(service.copyLink("owner-1", "ws-1", "invite-1")).resolves.toEqual({
                email: "an@example.test",
                link: LINK,
                delivery: "none",
            })
            expect(delivery.deliverInvite).not.toHaveBeenCalled()
        })

        it("answers token unavailable when the database mints no uuid", async () => {
            const { service } = await build(mockEntityManager({ query: [[MINT_UUID, []]] }))

            await expect(service.copyLink("owner-1", "ws-1", "invite-1")).rejects.toMatchObject({
                code: WorkspaceInvitesErrorCode.TokenUnavailable,
            })
        })
    })
})

describe("WorkspaceInvitesService", () => {
    describe("revoke", () => {
        it("revokes a pending invitation and logs the evidence", async () => {
            const em = mockEntityManager()
            const [revoke] = queueQueryBuilders(em, [{ execute: { raw: [CHANGED] } }])
            const { service, events } = await build(em)

            await expect(service.revoke("owner-1", "ws-1", "invite-1")).resolves.toBeUndefined()

            expect(revoke?.callsOf("update")).toEqual([[]])
            expect(revoke?.callsOf("set")).toEqual([[{ revokedAt: new Date(NOW) }]])
            expect(revoke?.callsOf("where")).toEqual([ROTATE_WHERE])
            expect(revoke?.callsOf("returning")).toEqual([["id, email, role"]])
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: "member.invite_revoked",
                actor: "Chu",
                summary: "an@example.test",
            })
        })

        it("answers not found for an invitation that is not pending in this workspace", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ execute: { raw: [] } }])
            const { service } = await build(em)

            await expect(service.revoke("owner-1", "ws-1", "invite-9")).rejects.toMatchObject({
                code: WorkspaceInvitesErrorCode.NotFound,
            })
        })
    })

    describe("preview", () => {
        it("shows the workspace, address, role and state behind a token", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [
                {
                    getRawOne: {
                        workspace_name: "Quan",
                        email: "an@example.test",
                        role: "staff",
                        staff_name: "An",
                        state: "pending",
                    },
                },
            ])
            const { service } = await build(em)

            await expect(service.preview(TOKEN)).resolves.toEqual({
                workspaceName: "Quan",
                email: "an@example.test",
                role: "staff",
                staffName: "An",
                state: "pending",
            })
            expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkspaceInviteEntity, "i")
            expect(read?.callsOf("innerJoin")).toEqual([[WorkspaceEntity, "w", "w.id = i.workspace_id"]])
            expect(read?.callsOf("leftJoin")).toEqual([[StaffEntity, "s", "s.id = i.staff_id"]])
            expect(read?.callsOf("where")).toEqual([["i.token_hash = :tokenHash", { tokenHash: HASH }]])
            expect(read?.callsOf("setParameter")).toEqual([["now", new Date(NOW)]])
        })

        it("refuses a token that matches no invitation", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ getRawOne: undefined }])
            const { service } = await build(em)

            await expect(service.preview(TOKEN)).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.Invalid })
        })
    })
})

describe("WorkspaceInvitesService accept", () => {
    const acceptor = { id: "user-2", email: "an@example.test" }

    it("joins the signed-in person to the workspace and answers its id", async () => {
        const em = managerFinding(inviteRowOf({ staff_id: "staff-1" }))
        const { service, members, events, accounts } = await build(em)
        accounts.accountOf.mockResolvedValue(ok(accountOf()))

        await expect(service.accept(acceptor, TOKEN)).resolves.toEqual({ workspaceId: "ws-1" })

        expect(em.findOne).toHaveBeenCalledWith(WorkspaceInviteEntity, { where: { tokenHash: HASH } })
        expect(members.join).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            userId: "user-2",
            role: "staff",
            staffId: "staff-1",
            displayName: "An",
        })
        expect(em.update).toHaveBeenCalledWith(
            WorkspaceInviteEntity,
            { id: "invite-1", acceptedAt: IsNull() },
            { acceptedAt: new Date(NOW), acceptedBy: "user-2" },
        )
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.joined",
            actor: "An",
            summary: "an@example.test",
        })
    })

    it("falls back to a generic name when Auth does not know the account", async () => {
        const { service, members, events, accounts } = await build(managerFinding(inviteRowOf()))
        accounts.accountOf.mockResolvedValue(refused("ACCOUNT_NOT_FOUND"))

        await expect(service.accept(acceptor, TOKEN)).resolves.toEqual({ workspaceId: "ws-1" })

        expect(members.join).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            userId: "user-2",
            role: "staff",
            staffId: null,
            displayName: "Member",
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.joined",
            actor: "Member",
            summary: "an@example.test",
        })
    })
})

describe("WorkspaceInvitesService accept", () => {
    const acceptor = { id: "user-2", email: "an@example.test" }

    it.each([
        ["a token that matches nothing", undefined, WorkspaceInvitesErrorCode.Invalid],
        [
            "a revoked invitation",
            inviteRowOf({ revoked_at: "2026-10-11T00:00:00.000Z" }),
            WorkspaceInvitesErrorCode.Revoked,
        ],
        ["a used invitation", inviteRowOf({ accepted_at: "2026-10-11T00:00:00.000Z" }), WorkspaceInvitesErrorCode.Used],
        [
            "an expired invitation",
            inviteRowOf({ expires_at: "2026-10-11T00:00:00.000Z" }),
            WorkspaceInvitesErrorCode.Expired,
        ],
        ["another address", inviteRowOf({ email: "other@example.test" }), WorkspaceInvitesErrorCode.EmailMismatch],
    ])("refuses %s and joins nobody", async (_name, row, code) => {
        const { service, members, events } = await build(managerFinding(row))

        await expect(service.accept(acceptor, TOKEN)).rejects.toMatchObject({ code })

        expect(members.join).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses a caller whose session carries no email", async () => {
        const { service, members } = await build(managerFinding(inviteRowOf()))
        await expect(service.accept({ id: "user-2" }, TOKEN)).rejects.toMatchObject({
            code: WorkspaceInvitesErrorCode.EmailMismatch,
        })
        expect(members.join).not.toHaveBeenCalled()
    })
})

describe("WorkspaceInvitesService accept", () => {
    it("records an empty summary when the session carries no email but the invitation allows it", async () => {
        const { service, events, accounts } = await build(managerFinding(inviteRowOf({ email: "" })))
        accounts.accountOf.mockResolvedValue(ok(accountOf()))
        await expect(service.accept({ id: "user-2" }, TOKEN)).resolves.toEqual({ workspaceId: "ws-1" })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "member.joined",
            actor: "An",
            summary: "",
        })
    })
})

describe("invitation link credentials", () => {
    it.each([
        inviteRowOf(),
        inviteRowOf({ accepted_at: NOW }),
        inviteRowOf({ revoked_at: NOW }),
        inviteRowOf({ expires_at: "2020-01-01T00:00:00.000Z" }),
    ])("resolves historical tokens without changing state (%p)", async (row) => {
        const { service } = await build(managerFinding(row))
        await expect(service.authenticateLink(TOKEN)).resolves.toEqual({
            kind: "link-token",
            subject: "invite-1",
            workspaceId: "ws-1",
        })
    })

    it("refuses an unknown token", async () => {
        const { service } = await build(managerFinding(undefined))
        await expect(service.authenticateLink(TOKEN)).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.Invalid })
    })

    it.each([
        { kind: "api-key" as const, subject: "invite-1", workspaceId: "ws-1" },
        { kind: "link-token" as const, subject: "other", workspaceId: "ws-1" },
        { kind: "link-token" as const, subject: "invite-1", workspaceId: "other" },
    ])("refuses a preview for a different principal (%p)", async (principal) => {
        const { service } = await build(managerFinding(inviteRowOf()))
        await expect(service.preview(TOKEN, principal)).rejects.toMatchObject({
            code: WorkspaceInvitesErrorCode.Invalid,
        })
    })

    it("retains the revoked preview for its bound principal", async () => {
        const em = managerFinding(inviteRowOf())
        queueQueryBuilders(em, [{ getRawOne: revokedInvitePreview }])
        const { service } = await build(em)
        await expect(
            service.preview(TOKEN, { kind: "link-token", subject: "invite-1", workspaceId: "ws-1" }),
        ).resolves.toMatchObject({ state: "revoked" })
    })
})
