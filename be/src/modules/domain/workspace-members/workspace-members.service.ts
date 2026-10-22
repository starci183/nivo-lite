import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { StaffService } from "@modules/domain/staff"
import type { StaffWrite } from "@modules/domain/staff"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused, unwrapOutcome } from "@modules/platform/primitives"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { MemberIdRow, MemberRow } from "./persistence/workspace-members.rows"
import {
    DELETE_MEMBER,
    ENSURE_MEMBER,
    FIND_MEMBER,
    FIND_MEMBER_ID,
    LIST_MEMBERS,
    LOCK_MEMBER,
    RENAME_MEMBER_EVERYWHERE,
    UPDATE_MEMBER_ROLE,
    UPDATE_MEMBER_STATUS,
    UPSERT_MEMBER,
} from "./persistence/workspace-members.sql"
import { admitMember, isManagerRole, judgeSeatChange, presentedRole } from "./role.policy"
import type { PresentedRole } from "./role.policy"
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
        private readonly staff: StaffService,
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

    /**
     * The member id (the seat) of the caller's active membership, or a typed refusal. Responsibilities, grants and the decision log
     * name this id, never the Auth user id and never a free-text name.
     */
    async idOf(userId: string, workspaceId: string): Promise<string> {
        const row = (await this.entityManager.query<Array<MemberIdRow>>(FIND_MEMBER_ID, [workspaceId, userId]))[0]
        return unwrapOutcome(
            row === undefined ? refused(WorkspaceMembersErrorCode.NotMember) : ok(row.id),
            WorkspaceMembersError,
        )
    }

    /** Adds or replaces a staff row. Owner and manager only. */
    async saveStaff(userId: string, input: StaffWrite): Promise<StaffOption> {
        await this.require(userId, input.workspaceId, MANAGERS)
        const saved = await this.staff.save(input)
        return { id: saved.id, name: saved.name, role: saved.role, email: saved.email, active: saved.active }
    }

    /** The caller's role in the workspace, named for the console; any member may read their own. */
    async roleOf(userId: string, workspaceId: string): Promise<PresentedRole> {
        const member = await this.require(userId, workspaceId)
        return presentedRole(member.role)
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

    /** Every staff row of the caller's workspace, active first, with email and whether they are active. */
    async listStaff(userId: string, workspaceId: string): Promise<ReadonlyArray<StaffOption>> {
        await this.require(userId, workspaceId)
        const rows = await this.staff.list(workspaceId)
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            role: row.role,
            email: row.email,
            active: row.active,
        }))
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

    /** An authenticated owner may add a missing seat; reruns retain existing state and refuse conflicting roles. */
    ensure(actorId: string, entry: JoinEntry): Promise<WorkspaceMember> {
        return this.entityManager.transaction(async (tx) => {
            const [actor] = await tx.query<Array<MemberRow>>(LOCK_MEMBER, [entry.workspaceId, actorId])
            if (actor === undefined) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.NotMember })
            unwrapOutcome(admitMember(toMember(actor), ["owner"]), WorkspaceMembersError)
            await tx.query(ENSURE_MEMBER, [
                entry.workspaceId,
                entry.userId,
                entry.role,
                entry.staffId,
                entry.displayName,
            ])
            const [row] = await tx.query<Array<MemberRow>>(FIND_MEMBER, [entry.workspaceId, entry.userId])
            if (row?.role !== entry.role || row.status !== "active")
                throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.EnsureConflict })
            return toMember(row)
        })
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
