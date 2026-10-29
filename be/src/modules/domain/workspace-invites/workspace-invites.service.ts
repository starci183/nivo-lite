import type { CredentialPrincipal } from "@modules/domain/identity"
import { Injectable } from "@nestjs/common"
import { IsNull, MoreThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import { EventsService } from "@modules/domain/events"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectAccountDirectory, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory, MemberListing } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { unwrapOutcome } from "@modules/platform/primitives"
import { WorkspaceInvitesError, WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { isEmailAddress, judgeInvite, normaliseEmail } from "./invite.policy"
import { firstChangedInvite } from "./changed-invite.policy"
import { hashInviteToken, mintedTokenOf, uuidOfRow } from "./invite-token.policy"
import { WorkspaceInviteEntity } from "./persistence/entities"
import type {
    AcceptedInvite,
    ChangedInvite,
    InviteAcceptor,
    InviteDeliveryPort,
    InvitePreview,
    InviteRequest,
    InviteResult,
    MintedToken,
    InviteState,
    PendingInvite,
} from "./workspace-invites.contracts"
import type { WorkspaceInvitesOptions } from "./workspace-invites.options"
import { InjectInviteDelivery, InjectWorkspaceInvitesOptions } from "./workspace-invites.port"

const DAY_MS = 86_400_000
const PENDING_INVITES_MAX = 200

/** The preview as the invitation row selects it. */
interface InvitePreviewRaw {
    /** The workspace the invitation is for. */
    readonly workspace_id: string
    /** The invited address. */
    readonly email: string
    /** The role it grants. */
    readonly role: string
    /** The staff row it links, when any. */
    readonly staff_id: string | null
    /** `pending`, `revoked`, `accepted` or `expired`. */
    readonly state: string
}

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
        private readonly workspaces: WorkspacesService,
        private readonly staff: StaffDirectoryService,
    ) {}

    /** The invitations of the caller's workspace that can still be accepted; owner and manager only. */
    async listPending(userId: string, workspaceId: string): Promise<ReadonlyArray<PendingInvite>> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const rows = await this.entityManager.find(WorkspaceInviteEntity, {
            select: { id: true, email: true, role: true, staffId: true, createdAt: true, expiresAt: true },
            where: {
                workspaceId,
                acceptedAt: IsNull(),
                revokedAt: IsNull(),
                expiresAt: MoreThan(this.clock.now()),
            },
            order: { createdAt: "DESC" },
            take: PENDING_INVITES_MAX,
        })
        return rows.map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            staffId: row.staffId,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
        }))
    }

    /** Issues an invitation and emails it; the token is returned once, inside the link. Owner and manager only. */
    async create(userId: string, workspaceId: string, request: InviteRequest): Promise<InviteResult> {
        const actor = await this.members.require(userId, workspaceId, MANAGERS)
        const pending = await this.entityManager.count(WorkspaceInviteEntity, {
            where: { workspaceId, acceptedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(this.clock.now()) },
        })
        await this.entitlements.requireRoomForInvite(workspaceId, pending)
        const email = normaliseEmail(request.email)
        if (!isEmailAddress(email)) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.EmailInvalid })
        const people = await this.members.list(userId, workspaceId)
        if (people.some((member) => member.email.toLowerCase() === email)) {
            throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.AlreadyMember })
        }
        const staffId = request.staffId ?? null
        if (staffId !== null) await this.requireStaffFree(workspaceId, staffId, email, people)
        const minted = await this.mintToken()
        await this.entityManager.transaction(async (scoped) => {
            const now = this.clock.now()
            await scoped
                .createQueryBuilder(WorkspaceInviteEntity, "i")
                .update()
                .set({ revokedAt: now })
                .where(
                    "workspace_id = :workspaceId AND lower(email) = :email AND accepted_at IS NULL AND revoked_at IS NULL",
                    {
                        workspaceId,
                        email,
                    },
                )
                .execute()
            await scoped.insert(WorkspaceInviteEntity, {
                workspaceId,
                email,
                role: request.role,
                staffId,
                tokenHash: hashInviteToken(minted.token),
                invitedBy: userId,
                expiresAt: this.expiry(now),
            })
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
        const result = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .update()
            .set({ revokedAt: this.clock.now() })
            .where("id = :inviteId AND workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL", {
                inviteId,
                workspaceId,
            })
            .returning("id, email, role")
            .execute()
        const revoked = firstChangedInvite(result.raw)
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
        const row = await this.findByToken(token)
        if (row === null) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.Invalid })
        return { kind: "link-token", subject: row.id, workspaceId: row.workspaceId }
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
        const row = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .select("i.workspace_id", "workspace_id")
            .addSelect("i.email", "email")
            .addSelect("i.role", "role")
            .addSelect("i.staff_id", "staff_id")
            .addSelect(
                `CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                WHEN i.accepted_at IS NOT NULL THEN 'accepted'
                WHEN i.expires_at < :now THEN 'expired'
                ELSE 'pending' END`,
                "state",
            )
            .where("i.token_hash = :tokenHash", { tokenHash: hashInviteToken(token) })
            .setParameter("now", this.clock.now())
            .limit(1)
            .getRawOne<InvitePreviewRaw>()
        if (row === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.Invalid })
        const [workspaceName, linked] = await Promise.all([
            this.workspaces.nameOf(row.workspace_id),
            row.staff_id === null ? [] : this.staff.namesOf(row.workspace_id, [row.staff_id]),
        ])
        return {
            workspaceName,
            email: row.email,
            role: row.role,
            staffName: linked[0]?.name ?? null,
            state: row.state,
        }
    }

    /** Accepts the invitation as the signed-in person whose email matches it; answers the workspace they joined. */
    async accept(acceptor: InviteAcceptor, token: string): Promise<AcceptedInvite> {
        const row = await this.findByToken(token)
        const invite = unwrapOutcome(
            judgeInvite(row === null ? undefined : toInviteState(row), acceptor.email ?? "", this.clock.now()),
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
        await this.entityManager.update(
            WorkspaceInviteEntity,
            { id: invite.id, acceptedAt: IsNull() },
            { acceptedAt: this.clock.now(), acceptedBy: acceptor.id },
        )
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
        return `${this.options.siteUrl}/auth/confirm?next=${encodeURIComponent("/invite/" + token)}`
    }

    private async requireStaffFree(
        workspaceId: string,
        staffId: string,
        email: string,
        people: ReadonlyArray<MemberListing>,
    ): Promise<void> {
        const held = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .select("i.id")
            .where("i.workspace_id = :workspaceId AND i.staff_id = :staffId", { workspaceId, staffId })
            .andWhere("i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > :now", {
                now: this.clock.now(),
            })
            .andWhere("lower(i.email) <> :email", { email })
            .limit(1)
            .getRawOne<{ readonly i_id: string }>()
        if (people.some((member) => member.staffId === staffId) || held !== undefined) {
            throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.StaffTaken })
        }
    }

    private async mintToken(): Promise<MintedToken> {
        const [first, second] = await Promise.all([this.uuid(), this.uuid()])
        return mintedTokenOf(first, second)
    }

    private async uuid(): Promise<string> {
        const [row] = await callDbFunction<{ gen_random_uuid: string }>(this.entityManager, "gen_random_uuid", [])
        return uuidOfRow(row)
    }

    private findByToken(token: string): Promise<WorkspaceInviteEntity | null> {
        return this.entityManager.findOne(WorkspaceInviteEntity, { where: { tokenHash: hashInviteToken(token) } })
    }

    private async rotate(workspaceId: string, inviteId: string): Promise<{ invite: ChangedInvite; token: string }> {
        const minted = await this.mintToken()
        const result = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .update()
            .set({ tokenHash: hashInviteToken(minted.token), expiresAt: this.expiry(this.clock.now()) })
            .where("id = :inviteId AND workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL", {
                inviteId,
                workspaceId,
            })
            .returning("id, email, role")
            .execute()
        const invite = firstChangedInvite(result.raw)
        if (invite === undefined) throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        return { invite, token: minted.token }
    }
}

const toInviteState = (row: WorkspaceInviteEntity): InviteState => ({
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    staffId: row.staffId,
    acceptedAt: row.acceptedAt === null ? null : row.acceptedAt.toISOString(),
    revokedAt: row.revokedAt === null ? null : row.revokedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
})
