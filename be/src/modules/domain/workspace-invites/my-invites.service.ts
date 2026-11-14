import { Injectable } from "@nestjs/common"
import { IsNull, MoreThan, type EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { WorkspaceAdminReadService } from "@modules/domain/workspaces"
import {
    InjectAccountDirectory,
    WorkspaceMembersService,
    type AccountDirectory,
} from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { WorkspaceInvitesError, WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { firstChangedInvite } from "./changed-invite.policy"
import { normaliseEmail } from "./invite.policy"
import { WorkspaceInviteEntity } from "./persistence/entities"
import type { AcceptedInvite, DeclinedInvite, InviteAcceptor, InviteForMe } from "./workspace-invites.contracts"
import { WorkspaceInvitesService } from "./workspace-invites.service"

const DAY_MS = 86_400_000

/** How long the team page shows an invitation after it was declined. */
const DECLINED_SHOWN_DAYS = 30

const MANAGERS = ["owner", "manager"] as const

/** The most invitations the lobby lists for one person. */
const MINE_MAX = 50

/** A pending invitation: neither accepted nor revoked, and not expired at `:now`. */
const PENDING = "i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.declined_at IS NULL AND i.expires_at > :now"

@Injectable()
/** The invitations addressed to the signed-in person (the workspaces lobby), declining one, and revoking a deleted workspace's. */
export class MyInvitesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
        private readonly workspaces: WorkspaceAdminReadService,
        private readonly events: EventsService,
        private readonly invites: WorkspaceInvitesService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Joins, by its id, the workspace a pending invitation to the signed-in address names, as the link does. */
    join(acceptor: InviteAcceptor, inviteId: string): Promise<AcceptedInvite> {
        return this.invites.acceptById(acceptor, inviteId)
    }

    /** The pending invitations to the signed-in address, newest first, with their workspace and who invited; none without an address. */
    async listMine(acceptor: InviteAcceptor): Promise<ReadonlyArray<InviteForMe>> {
        const email = normaliseEmail(acceptor.email ?? "")
        if (email === "") return []
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .where(`lower(i.email) = :email AND ${PENDING}`, { email, now: this.clock.now() })
            .orderBy("i.created_at", "DESC")
            .limit(MINE_MAX)
            .getMany()
        if (rows.length === 0) return []
        const names = await this.workspaces.namesOf([...new Set(rows.map((row) => row.workspaceId))], MINE_MAX)
        const nameOf = new Map(names.map((named) => [named.id, named.name]))
        const inviters = await this.invitersOf(rows)
        return rows.flatMap((row) => {
            const workspaceName = nameOf.get(row.workspaceId)
            if (workspaceName === undefined) return []
            return [
                {
                    id: row.id,
                    workspaceId: row.workspaceId,
                    workspaceName,
                    role: row.role,
                    invitedByName: row.invitedBy === null ? null : (inviters.get(row.invitedBy) ?? null),
                    expiresAt: row.expiresAt.toISOString(),
                },
            ]
        })
    }

    /** Declines a pending invitation to the signed-in address: its link stops working, and the inviter sees it as declined, not revoked. */
    async decline(acceptor: InviteAcceptor, inviteId: string): Promise<void> {
        const email = normaliseEmail(acceptor.email ?? "")
        if (email === "") throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        const result = await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .update()
            .set({ declinedAt: this.clock.now(), declinedBy: acceptor.id })
            .where(
                "id = :inviteId AND lower(email) = :email AND accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL",
                {
                    inviteId,
                    email,
                },
            )
            .returning("id, email, role, workspace_id")
            .execute()
        if (firstChangedInvite(result.raw) === undefined)
            throw new WorkspaceInvitesError({ code: WorkspaceInvitesErrorCode.NotFound })
        const workspaceId = workspaceIdOf(result.raw)
        if (workspaceId !== undefined)
            await this.events.record({ workspaceId, kind: "member.invite_declined", actor: email, summary: email })
    }

    /** The invitations of the caller's workspace declined in the last days, newest first; owner and manager only. */
    async listDeclined(userId: string, workspaceId: string): Promise<ReadonlyArray<DeclinedInvite>> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const since = new Date(this.clock.now().getTime() - DECLINED_SHOWN_DAYS * DAY_MS)
        const rows = await this.entityManager.find(WorkspaceInviteEntity, {
            select: { id: true, email: true, role: true, declinedAt: true },
            where: { workspaceId, acceptedAt: IsNull(), revokedAt: IsNull(), declinedAt: MoreThan(since) },
            order: { declinedAt: "DESC" },
            take: MINE_MAX,
        })
        return rows.map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            declinedAt: (row.declinedAt ?? since).toISOString(),
        }))
    }

    /** Revokes every pending invitation of a workspace its owner deleted, so no link can bring a member back. */
    async revokeAllOf(workspaceId: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(WorkspaceInviteEntity, "i")
            .update()
            .set({ revokedAt: this.clock.now() })
            .where(
                "workspace_id = :workspaceId AND accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL",
                { workspaceId },
            )
            .execute()
    }

    /** The display names of the accounts that sent the invitations, each account read once. */
    private async invitersOf(rows: ReadonlyArray<WorkspaceInviteEntity>): Promise<Map<string, string>> {
        const ids = [...new Set(rows.flatMap((row) => (row.invitedBy === null ? [] : [row.invitedBy])))]
        const names = new Map<string, string>()
        await eachInOrder(ids, async (id) => {
            const account = await this.accounts.accountOf(id)
            if (account.kind === "ok") names.set(id, account.value.displayName)
        })
        return names
    }
}

/** The workspace of the first row a RETURNING write changed. */
const workspaceIdOf = (raw: unknown): string | undefined => {
    const first: unknown = Array.isArray(raw) ? raw[0] : undefined
    return isRecord(first) && typeof first.workspace_id === "string" ? first.workspace_id : undefined
}
