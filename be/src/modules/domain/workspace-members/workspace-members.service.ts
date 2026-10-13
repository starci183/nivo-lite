import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { refused, unwrapOutcome } from "@modules/platform/primitives"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { MemberRow, StaffRow } from "./persistence/workspace-members.rows"
import {
    DELETE_MEMBER,
    FIND_MEMBER,
    LIST_ACTIVE_STAFF,
    LIST_MEMBERS,
    RENAME_MEMBER_EVERYWHERE,
    UPDATE_MEMBER_ROLE,
    UPDATE_MEMBER_STATUS,
    UPSERT_MEMBER,
} from "./persistence/workspace-members.sql"
import { admitMember, isManagerRole, judgeSeatChange } from "./role.policy"
import type {
    AccountDirectory,
    JoinEntry,
    MemberListing,
    MemberStatus,
    SeatPair,
    SeatRule,
    StaffOption,
    WorkspaceMember,
    WorkspaceRole,
} from "./workspace-members.contracts"
import { InjectAccountDirectory } from "./workspace-members.port"

const toMember = (row: MemberRow): WorkspaceMember => ({
    userId: row.user_id,
    workspaceId: row.workspace_id,
    role: row.role,
    staffId: row.staff_id,
    displayName: row.display_name,
    status: row.status,
})

const MANAGERS = ["owner", "manager"] as const

/** The table guard raises `last_owner` when a change would leave a workspace without an active owner. */
const isLastOwnerFailure = (cause: unknown): boolean => cause instanceof Error && cause.message.includes("last_owner")

@Injectable()
/** Who belongs to which workspace and in which role; the only owner of workspace_members. */
export class WorkspaceMembersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
        private readonly events: EventsService,
    ) {}

    /**
     * The caller's active membership in the workspace, or a typed refusal; when `roles` is not empty the role must be one
     * of them. The workspace id is only a selector: this call is the proof of access.
     */
    async require(
        userId: string,
        workspaceId: string,
        roles: ReadonlyArray<WorkspaceRole> = [],
    ): Promise<WorkspaceMember> {
        const row = (await this.entityManager.query<Array<MemberRow>>(FIND_MEMBER, [workspaceId, userId]))[0]
        const outcome =
            row === undefined ? refused(WorkspaceMembersErrorCode.NotMember) : admitMember(toMember(row), roles)
        return unwrapOutcome(outcome, WorkspaceMembersError)
    }

    /** Everyone in the caller's workspace, owners first; emails and sign-ins are blank for staff callers. */
    async list(userId: string, workspaceId: string): Promise<ReadonlyArray<MemberListing>> {
        const viewer = await this.require(userId, workspaceId)
        const rows = await this.entityManager.query<Array<MemberRow>>(LIST_MEMBERS, [workspaceId])
        const showContact = isManagerRole(viewer.role)
        return Promise.all(
            rows.map(async (row) => {
                const account = showContact ? await this.accounts.accountOf(row.user_id) : undefined
                const known = account?.kind === "ok" ? account.value : undefined
                return { ...toMember(row), email: known?.email ?? "", lastSignInAt: known?.lastSignInAt ?? null }
            }),
        )
    }

    /** The active staff rows of the caller's workspace a member can be linked to. */
    async listStaff(userId: string, workspaceId: string): Promise<ReadonlyArray<StaffOption>> {
        await this.require(userId, workspaceId)
        return this.entityManager.query<Array<StaffRow>>(LIST_ACTIVE_STAFF, [workspaceId])
    }

    /** Changes a member's role: an owner grants any role, a manager only manager or staff. */
    async changeRole(actorId: string, workspaceId: string, targetId: string, role: WorkspaceRole): Promise<void> {
        const { actor, target } = await this.seats(actorId, workspaceId, targetId, {
            nextRole: role,
            forbidSelf: false,
        })
        if (target.role === role) return
        await this.apply(UPDATE_MEMBER_ROLE, [workspaceId, targetId, role])
        await this.events.record({
            workspaceId,
            kind: "member.role_changed",
            actor: actor.displayName,
            summary: `${target.displayName}: ${target.role} -> ${role}`,
        })
    }

    /** Disables (cannot sign in to the workspace) or enables a member; never one's own account. */
    async setStatus(actorId: string, workspaceId: string, targetId: string, status: MemberStatus): Promise<void> {
        const { actor, target } = await this.seats(actorId, workspaceId, targetId, { forbidSelf: true })
        await this.apply(UPDATE_MEMBER_STATUS, [workspaceId, targetId, status])
        await this.events.record({
            workspaceId,
            kind: status === "disabled" ? "member.disabled" : "member.enabled",
            actor: actor.displayName,
            summary: target.displayName,
        })
    }

    /** Removes a member from the workspace (their account and past work stay); never one's own account. */
    async remove(actorId: string, workspaceId: string, targetId: string): Promise<void> {
        const { actor, target } = await this.seats(actorId, workspaceId, targetId, { forbidSelf: true })
        await this.apply(DELETE_MEMBER, [workspaceId, targetId])
        await this.events.record({
            workspaceId,
            kind: "member.removed",
            actor: actor.displayName,
            summary: target.displayName,
        })
    }

    /** Saves the display name a person carries in every workspace they actively belong to. */
    async renameSelf(userId: string, displayName: string): Promise<void> {
        await this.entityManager.query(RENAME_MEMBER_EVERYWHERE, [userId, displayName.trim()])
    }

    /** Creates or reactivates a membership; an owner is never demoted and a staff link is never dropped. */
    async join(entry: JoinEntry): Promise<void> {
        await this.entityManager.query(UPSERT_MEMBER, [
            entry.workspaceId,
            entry.userId,
            entry.role,
            entry.staffId,
            entry.displayName,
        ])
    }

    private async seats(actorId: string, workspaceId: string, targetId: string, rule: SeatRule): Promise<SeatPair> {
        const actor = await this.require(actorId, workspaceId, MANAGERS)
        const row = (await this.entityManager.query<Array<MemberRow>>(FIND_MEMBER, [workspaceId, targetId]))[0]
        if (row === undefined) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.MemberNotFound })
        const pair: SeatPair = { actor, target: toMember(row) }
        unwrapOutcome(judgeSeatChange(pair, rule), WorkspaceMembersError)
        return pair
    }

    private async apply(statement: typeof DELETE_MEMBER, params: ReadonlyArray<string>): Promise<void> {
        const changed = await this.entityManager
            .query<Array<{ user_id: string }>>(statement, [...params])
            .catch((cause: unknown) => {
                if (isLastOwnerFailure(cause)) {
                    throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.LastOwner, cause })
                }
                throw cause
            })
        if (changed.length === 0) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.MemberNotFound })
    }
}
