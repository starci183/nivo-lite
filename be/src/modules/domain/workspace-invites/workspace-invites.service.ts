import type { CredentialPrincipal } from "@modules/domain/identity"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import { EventsService } from "@modules/domain/events"
import { InjectAccountDirectory, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory, MemberListing } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { unwrapOutcome } from "@modules/platform/primitives"
import { WorkspaceInvitesError, WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { isEmailAddress, judgeInvite, normaliseEmail } from "./invite.policy"
import type {
    ChangedInviteRow,
    HeldRow,
    InvitePreviewRow,
    InviteRow,
    MintedTokenRow,
    PendingInviteRow,
} from "./persistence/workspace-invites.rows"
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
import type {
    AcceptedInvite,
    InviteAcceptor,
    InviteDeliveryPort,
    InvitePreview,
    InviteRequest,
    InviteResult,
    InviteState,
    PendingInvite,
} from "./workspace-invites.contracts"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"
import { InjectInviteDelivery, InjectWorkspaceInvitesOptions } from "./workspace-invites.port"

const DAY_MS = 86_400_000
const MANAGERS = ["owner", "manager"] as const

@Injectable()
/** Email invitations into a workspace: issue, resend, copy the link, revoke and accept. */
export class WorkspaceInvitesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectWorkspaceInvitesOptions() private readonly options: WorkspaceInvitesOptions,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
        @InjectInviteDelivery() private readonly delivery: InviteDeliveryPort,
        private readonly members: WorkspaceMembersService,
        private readonly events: EventsService,
        private readonly entitlements: EntitlementsService,
    ) {}

    /** The invitations of the caller's workspace that can still be accepted; owner and manager only. */
    async listPending(userId: string, workspaceId: string): Promise<ReadonlyArray<PendingInvite>> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const rows = await this.entityManager.query<Array<PendingInviteRow>>(LIST_PENDING_INVITES, [
            workspaceId,
            this.clock.now(),
        ])
        return rows.map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            staffId: row.staff_id,
            createdAt: new Date(row.created_at).toISOString(),
            expiresAt: new Date(row.expires_at).toISOString(),
        }))
    }

    /** Issues an invitation and emails it; the token is returned once, inside the link. Owner and manager only. */
    async create(userId: string, workspaceId: string, request: InviteRequest): Promise<InviteResult> {
        const actor = await this.members.require(userId, workspaceId, MANAGERS)
        await this.entitlements.requireRoomForInvite(workspaceId)
        const email = normaliseEmail(request.email)
        if (!isEmailAddress(email)) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.EmailInvalid })
        const people = await this.members.list(userId, workspaceId)
        if (people.some((member) => member.email.toLowerCase() === email)) {
            throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.AlreadyMember })
        }
        const staffId = request.staffId ?? null
        if (staffId !== null) await this.requireStaffFree(workspaceId, staffId, email, people)
        const [minted] = await this.entityManager.query<[MintedTokenRow]>(MINT_TOKEN)
        await this.entityManager.transaction(async (scoped) => {
            const now = this.clock.now()
            await scoped.query(REVOKE_PENDING_FOR_EMAIL, [workspaceId, email, now])
            await scoped.query(INSERT_INVITE, [
                workspaceId,
                email,
                request.role,
                staffId,
                minted.token,
                userId,
                this.expiry(now),
            ])
        })
        const delivery = await this.delivery.deliverInvite(email, this.redirectOf(minted.token))
        await this.events.record({
            workspaceId,
            kind: "member.invited",
            actor: actor.displayName,
            summary: `${email} \u00b7 ${request.role}`,
        })
        return { email, link: this.linkOf(minted.token), delivery }
    }

    /** Gives a pending invitation a new link (the old one stops working) and emails it again. */
    async resend(userId: string, workspaceId: string, inviteId: string): Promise<InviteResult> {
        const actor = await this.members.require(userId, workspaceId, MANAGERS)
        const { invite, token } = await this.rotate(workspaceId, inviteId)
        const delivery = await this.delivery.deliverInvite(invite.email, this.redirectOf(token))
        await this.events.record({
            workspaceId,
            kind: "member.invite_resent",
            actor: actor.displayName,
            summary: invite.email,
        })
        return { email: invite.email, link: this.linkOf(token), delivery }
    }

    /** Issues a fresh link without emailing it; the stored hash cannot be reversed, so the old link stops working. */
    async copyLink(userId: string, workspaceId: string, inviteId: string): Promise<InviteResult> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const { invite, token } = await this.rotate(workspaceId, inviteId)
        return { email: invite.email, link: this.linkOf(token), delivery: "none" }
    }

    /** Revokes a pending invitation: its link stops working at once. */
    async revoke(userId: string, workspaceId: string, inviteId: string): Promise<void> {
        const actor = await this.members.require(userId, workspaceId, MANAGERS)
        const [revoked] = await this.entityManager.query<Array<ChangedInviteRow>>(REVOKE_INVITE, [
            inviteId,
            workspaceId,
            this.clock.now(),
        ])
        if (revoked === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        await this.events.record({
            workspaceId,
            kind: "member.invite_revoked",
            actor: actor.displayName,
            summary: revoked.email,
        })
    }

    /** Resolves a preview token to its stored invitation, including historical states. */
    async authenticateLink(token: string): Promise<CredentialPrincipal> {
        const [row] = await this.entityManager.query<Array<InviteRow>>(FIND_INVITE_BY_TOKEN, [token])
        if (row === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.Invalid })
        return { kind: "link-token", subject: row.id, workspaceId: row.workspace_id }
    }

    /** What the person sees before accepting; a token that matches nothing is refused. */
    async preview(token: string, principal?: CredentialPrincipal): Promise<InvitePreview> {
        if (principal !== undefined) {
            const bound = await this.authenticateLink(token)
            if (
                principal.kind !== bound.kind ||
                principal.subject !== bound.subject ||
                principal.workspaceId !== bound.workspaceId
            )
                throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.Invalid })
        }
        const [row] = await this.entityManager.query<Array<InvitePreviewRow>>(PREVIEW_INVITE, [token, this.clock.now()])
        if (row === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.Invalid })
        return {
            workspaceName: row.workspace_name,
            email: row.email,
            role: row.role,
            staffName: row.staff_name,
            state: row.state,
        }
    }

    /** Accepts the invitation as the signed-in person whose email matches it; answers the workspace they joined. */
    async accept(acceptor: InviteAcceptor, token: string): Promise<AcceptedInvite> {
        const [row] = await this.entityManager.query<Array<InviteRow>>(FIND_INVITE_BY_TOKEN, [token])
        const invite = unwrapOutcome(
            judgeInvite(row === undefined ? undefined : toInviteState(row), acceptor.email ?? "", this.clock.now()),
            WorkspaceInvitesError,
        )
        await this.entitlements.requireRoomForMember(invite.workspaceId)
        const account = await this.accounts.accountOf(acceptor.id)
        const displayName = account.kind === "ok" ? account.value.displayName : "Member"
        await this.members.join({
            workspaceId: invite.workspaceId,
            userId: acceptor.id,
            role: invite.role,
            staffId: invite.staffId,
            displayName,
        })
        await this.entityManager.query(MARK_INVITE_ACCEPTED, [invite.id, this.clock.now(), acceptor.id])
        await this.events.record({
            workspaceId: invite.workspaceId,
            kind: "member.joined",
            actor: displayName,
            summary: acceptor.email ?? "",
        })
        return { workspaceId: invite.workspaceId }
    }

    private expiry(from: Date): Date {
        return new Date(from.getTime() + this.options.inviteDays * DAY_MS)
    }

    private linkOf(token: string): string {
        return `${this.options.siteUrl}/invite/${token}`
    }

    private redirectOf(token: string): string {
        return `${this.options.siteUrl}/auth/confirm?next=${encodeURIComponent(`/invite/${token}`)}`
    }

    private async requireStaffFree(
        workspaceId: string,
        staffId: string,
        email: string,
        people: ReadonlyArray<MemberListing>,
    ): Promise<void> {
        const held = await this.entityManager.query<Array<HeldRow>>(FIND_STAFF_INVITE, [
            workspaceId,
            staffId,
            this.clock.now(),
            email,
        ])
        if (people.some((member) => member.staffId === staffId) || held.length > 0) {
            throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.StaffTaken })
        }
    }

    private async rotate(workspaceId: string, inviteId: string): Promise<{ invite: ChangedInviteRow; token: string }> {
        const [minted] = await this.entityManager.query<[MintedTokenRow]>(MINT_TOKEN)
        const [invite] = await this.entityManager.query<Array<ChangedInviteRow>>(ROTATE_INVITE, [
            inviteId,
            workspaceId,
            minted.token,
            this.expiry(this.clock.now()),
        ])
        if (invite === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        return { invite, token: minted.token }
    }
}

const toInviteState = (row: InviteRow): InviteState => ({
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    staffId: row.staff_id,
    acceptedAt: row.accepted_at === null ? null : new Date(row.accepted_at).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
})
