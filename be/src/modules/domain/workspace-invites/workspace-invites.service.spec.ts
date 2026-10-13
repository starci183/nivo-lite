import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EntitlementsService } from "@modules/domain/billing"
import { EventsService } from "@modules/domain/events"
import { ACCOUNT_DIRECTORY, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory, MemberListing, WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import type { InviteRow, PendingInviteRow } from "./persistence/workspace-invites.rows"
import {
    FIND_INVITE_BY_TOKEN,
    FIND_STAFF_INVITE,
    INSERT_INVITE,
    LIST_PENDING_INVITES,
    MARK_INVITE_ACCEPTED,
    MINT_TOKEN,
    PREVIEW_INVITE,
    REVOKE_INVITE,
    REVOKE_PENDING_FOR_EMAIL,
    ROTATE_INVITE,
} from "./persistence/workspace-invites.sql"
import type { InviteDeliveryPort } from "./workspace-invites.contracts"
import { INVITE_DELIVERY, WORKSPACE_INVITES_OPTIONS } from "./workspace-invites.port"
import { WorkspaceInvitesService } from "./workspace-invites.service"

const NOW = "2026-10-12T00:00:00.000Z"
const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
const LINK = `https://app.test/invite/${TOKEN}`
const REDIRECT = `https://app.test/auth/confirm?next=${encodeURIComponent(`/invite/${TOKEN}`)}`
const EXPIRES = new Date("2026-10-19T00:00:00.000Z")

const actorOf = builder<WorkspaceMember>({
    userId: "owner-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Chu",
    status: "active",
})

const listingOf = builder<MemberListing>({
    ...actorOf(),
    email: "chu@example.test",
    lastSignInAt: null,
})

const accountOf = () => ({
    id: "user-2",
    email: "an@example.test",
    lastSignInAt: null,
    avatarUrl: null,
    displayName: "An",
})

const inviteRowOf = builder<InviteRow>({
    id: "invite-1",
    workspace_id: "ws-1",
    email: "An@Example.test",
    role: "staff",
    staff_id: null,
    accepted_at: null,
    revoked_at: null,
    expires_at: "2026-10-19T00:00:00.000Z",
})

const build = async (entityManager: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(actorOf())
    const events = mock<EventsService>()
    const accounts = mock<AccountDirectory>()
    const delivery = mock<InviteDeliveryPort>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceInvitesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            {
                provide: WORKSPACE_INVITES_OPTIONS,
                useValue: { delivery: "invite-delivery", siteUrl: "https://app.test", inviteDays: 7 },
            },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
            { provide: INVITE_DELIVERY, useValue: delivery },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: EntitlementsService, useValue: mock<EntitlementsService>() },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceInvitesService), members, events, accounts, delivery }
}

const issuingStubs = {
    query: [
        [MINT_TOKEN, [{ token: TOKEN }]],
        [REVOKE_PENDING_FOR_EMAIL, []],
        [INSERT_INVITE, []],
        [FIND_STAFF_INVITE, []],
    ],
} as const

describe("WorkspaceInvitesService", () => {
    describe("listPending", () => {
        it("lists the invitations that can still be accepted", async () => {
            const row: PendingInviteRow = {
                id: "invite-1",
                email: "an@example.test",
                role: "manager",
                staff_id: "staff-1",
                created_at: "2026-10-10T00:00:00.000Z",
                expires_at: "2026-10-17T00:00:00.000Z",
            }
            const em = mockEntityManager({ query: [LIST_PENDING_INVITES, [row]] })
            const { service, members } = await build(em)

            await expect(service.listPending("owner-1", "ws-1")).resolves.toEqual([
                {
                    id: "invite-1",
                    email: "an@example.test",
                    role: "manager",
                    staffId: "staff-1",
                    createdAt: "2026-10-10T00:00:00.000Z",
                    expiresAt: "2026-10-17T00:00:00.000Z",
                },
            ])
            expect(members.require).toHaveBeenCalledWith("owner-1", "ws-1", ["owner", "manager"])
            expect(em.query).toHaveBeenCalledWith(LIST_PENDING_INVITES, ["ws-1", new Date(NOW)])
        })

        it("passes on the refusal of the membership check", async () => {
            const em = mockEntityManager()
            const { service, members } = await build(em)
            members.require.mockRejectedValue(new Error("refused"))

            await expect(service.listPending("user-9", "ws-1")).rejects.toThrow("refused")
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("create", () => {
        it("stores the invitation by token hash, emails it and logs the evidence", async () => {
            const tx = fakeTransaction(mockEntityManager(issuingStubs))
            const { service, members, events, delivery } = await build(tx.em)
            members.list.mockResolvedValue([listingOf()])
            delivery.deliverInvite.mockResolvedValue("invited")

            await expect(
                service.create("owner-1", "ws-1", { email: "  An@Example.TEST ", role: "staff" }),
            ).resolves.toEqual({ email: "an@example.test", link: LINK, delivery: "invited" })

            expect(tx.em.query).toHaveBeenCalledWith(REVOKE_PENDING_FOR_EMAIL, [
                "ws-1",
                "an@example.test",
                new Date(NOW),
            ])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_INVITE, [
                "ws-1",
                "an@example.test",
                "staff",
                null,
                TOKEN,
                "owner-1",
                EXPIRES,
            ])
            expect(delivery.deliverInvite).toHaveBeenCalledWith("an@example.test", REDIRECT)
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: "member.invited",
                actor: "Chu",
                summary: "an@example.test · staff",
            })
            expect(tx.commits).toBe(1)
        })

        it("links a free staff row to the invitation", async () => {
            const tx = fakeTransaction(mockEntityManager(issuingStubs))
            const { service, members, delivery } = await build(tx.em)
            members.list.mockResolvedValue([listingOf()])
            delivery.deliverInvite.mockResolvedValue("none")

            await expect(
                service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
            ).resolves.toMatchObject({ delivery: "none" })

            expect(tx.em.query).toHaveBeenCalledWith(FIND_STAFF_INVITE, [
                "ws-1",
                "staff-1",
                new Date(NOW),
                "an@example.test",
            ])
        })

        it("refuses an address that is not an email", async () => {
            const { service, members } = await build(mockEntityManager())

            await expect(
                service.create("owner-1", "ws-1", { email: "not-an-email", role: "staff" }),
            ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.EmailInvalid })
            expect(members.list).not.toHaveBeenCalled()
        })

        it("refuses an address that already belongs to a member", async () => {
            const { service, members } = await build(mockEntityManager())
            members.list.mockResolvedValue([listingOf({ email: "AN@example.test" })])

            await expect(
                service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff" }),
            ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.AlreadyMember })
        })

        it("refuses a staff row that a member already has", async () => {
            const em = mockEntityManager({ query: [FIND_STAFF_INVITE, []] })
            const { service, members } = await build(em)
            members.list.mockResolvedValue([listingOf({ staffId: "staff-1" })])

            await expect(
                service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
            ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.StaffTaken })
        })

        it("refuses a staff row that another pending invitation holds", async () => {
            const em = mockEntityManager({ query: [FIND_STAFF_INVITE, [{ id: "invite-9" }]] })
            const { service, members } = await build(em)
            members.list.mockResolvedValue([listingOf()])

            await expect(
                service.create("owner-1", "ws-1", { email: "an@example.test", role: "staff", staffId: "staff-1" }),
            ).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.StaffTaken })
        })
    })

    describe("resend", () => {
        it("rotates the link, emails it again and logs the evidence", async () => {
            const em = mockEntityManager({
                query: [
                    [MINT_TOKEN, [{ token: TOKEN }]],
                    [ROTATE_INVITE, [{ id: "invite-1", email: "an@example.test", role: "staff" }]],
                ],
            })
            const { service, events, delivery } = await build(em)
            delivery.deliverInvite.mockResolvedValue("existing")

            await expect(service.resend("owner-1", "ws-1", "invite-1")).resolves.toEqual({
                email: "an@example.test",
                link: LINK,
                delivery: "existing",
            })

            expect(em.query).toHaveBeenCalledWith(ROTATE_INVITE, ["invite-1", "ws-1", TOKEN, EXPIRES])
            expect(delivery.deliverInvite).toHaveBeenCalledWith("an@example.test", REDIRECT)
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: "member.invite_resent",
                actor: "Chu",
                summary: "an@example.test",
            })
        })

        it("answers not found for an invitation that is not pending in this workspace", async () => {
            const em = mockEntityManager({
                query: [
                    [MINT_TOKEN, [{ token: TOKEN }]],
                    [ROTATE_INVITE, []],
                ],
            })
            const { service, delivery } = await build(em)

            await expect(service.resend("owner-1", "ws-1", "invite-9")).rejects.toMatchObject({
                code: WorkspaceInvitesErrorCode.NotFound,
            })
            expect(delivery.deliverInvite).not.toHaveBeenCalled()
        })
    })

    describe("copyLink", () => {
        it("issues a fresh link without emailing it", async () => {
            const em = mockEntityManager({
                query: [
                    [MINT_TOKEN, [{ token: TOKEN }]],
                    [ROTATE_INVITE, [{ id: "invite-1", email: "an@example.test", role: "staff" }]],
                ],
            })
            const { service, delivery } = await build(em)

            await expect(service.copyLink("owner-1", "ws-1", "invite-1")).resolves.toEqual({
                email: "an@example.test",
                link: LINK,
                delivery: "none",
            })
            expect(delivery.deliverInvite).not.toHaveBeenCalled()
        })
    })

    describe("revoke", () => {
        it("revokes a pending invitation and logs the evidence", async () => {
            const em = mockEntityManager({
                query: [REVOKE_INVITE, [{ id: "invite-1", email: "an@example.test", role: "staff" }]],
            })
            const { service, events } = await build(em)

            await expect(service.revoke("owner-1", "ws-1", "invite-1")).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(REVOKE_INVITE, ["invite-1", "ws-1", new Date(NOW)])
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: "member.invite_revoked",
                actor: "Chu",
                summary: "an@example.test",
            })
        })

        it("answers not found for an invitation that is not pending in this workspace", async () => {
            const { service } = await build(mockEntityManager({ query: [REVOKE_INVITE, []] }))

            await expect(service.revoke("owner-1", "ws-1", "invite-9")).rejects.toMatchObject({
                code: WorkspaceInvitesErrorCode.NotFound,
            })
        })
    })

    describe("preview", () => {
        it("shows the workspace, address, role and state behind a token", async () => {
            const em = mockEntityManager({
                query: [
                    PREVIEW_INVITE,
                    [
                        {
                            workspace_name: "Quan",
                            email: "an@example.test",
                            role: "staff",
                            staff_name: "An",
                            state: "pending",
                        },
                    ],
                ],
            })
            const { service } = await build(em)

            await expect(service.preview(TOKEN)).resolves.toEqual({
                workspaceName: "Quan",
                email: "an@example.test",
                role: "staff",
                staffName: "An",
                state: "pending",
            })
            expect(em.query).toHaveBeenCalledWith(PREVIEW_INVITE, [TOKEN, new Date(NOW)])
        })

        it("refuses a token that matches no invitation", async () => {
            const { service } = await build(mockEntityManager({ query: [PREVIEW_INVITE, []] }))

            await expect(service.preview(TOKEN)).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.Invalid })
        })
    })

    describe("accept", () => {
        const acceptor = { id: "user-2", email: "an@example.test" }
        const acceptQuery = (row: InviteRow | undefined) => ({
            query: [
                [FIND_INVITE_BY_TOKEN, row === undefined ? [] : [row]],
                [MARK_INVITE_ACCEPTED, []],
            ] as const,
        })

        it("joins the signed-in person to the workspace and answers its id", async () => {
            const em = mockEntityManager(acceptQuery(inviteRowOf({ staff_id: "staff-1" })))
            const { service, members, events, accounts } = await build(em)
            accounts.accountOf.mockResolvedValue(ok(accountOf()))

            await expect(service.accept(acceptor, TOKEN)).resolves.toEqual({ workspaceId: "ws-1" })

            expect(em.query).toHaveBeenCalledWith(FIND_INVITE_BY_TOKEN, [TOKEN])
            expect(members.join).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "user-2",
                role: "staff",
                staffId: "staff-1",
                displayName: "An",
            })
            expect(em.query).toHaveBeenCalledWith(MARK_INVITE_ACCEPTED, ["invite-1", new Date(NOW), "user-2"])
            expect(events.record).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                kind: "member.joined",
                actor: "An",
                summary: "an@example.test",
            })
        })

        it("falls back to a generic name when Auth does not know the account", async () => {
            const { service, members, events, accounts } = await build(mockEntityManager(acceptQuery(inviteRowOf())))
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

        it.each([
            ["a token that matches nothing", undefined, WorkspaceInvitesErrorCode.Invalid],
            [
                "a revoked invitation",
                inviteRowOf({ revoked_at: "2026-10-11T00:00:00.000Z" }),
                WorkspaceInvitesErrorCode.Revoked,
            ],
            [
                "a used invitation",
                inviteRowOf({ accepted_at: "2026-10-11T00:00:00.000Z" }),
                WorkspaceInvitesErrorCode.Used,
            ],
            [
                "an expired invitation",
                inviteRowOf({ expires_at: "2026-10-11T00:00:00.000Z" }),
                WorkspaceInvitesErrorCode.Expired,
            ],
            ["another address", inviteRowOf({ email: "other@example.test" }), WorkspaceInvitesErrorCode.EmailMismatch],
        ])("refuses %s and joins nobody", async (_name, row, code) => {
            const { service, members, events } = await build(mockEntityManager(acceptQuery(row)))

            await expect(service.accept(acceptor, TOKEN)).rejects.toMatchObject({ code })

            expect(members.join).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
        })

        it("refuses a caller whose session carries no email", async () => {
            const { service, members } = await build(mockEntityManager(acceptQuery(inviteRowOf())))

            await expect(service.accept({ id: "user-2" }, TOKEN)).rejects.toMatchObject({
                code: WorkspaceInvitesErrorCode.EmailMismatch,
            })
            expect(members.join).not.toHaveBeenCalled()
        })

        it("records an empty summary when the session carries no email but the invitation allows it", async () => {
            const { service, events, accounts } = await build(
                mockEntityManager(acceptQuery(inviteRowOf({ email: "" }))),
            )
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
})
