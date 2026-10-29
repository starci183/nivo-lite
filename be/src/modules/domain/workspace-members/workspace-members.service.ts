import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { StaffDirectoryService, StaffService } from "@modules/domain/staff"
import type { StaffWrite } from "@modules/domain/staff"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused, unwrapOutcome } from "@modules/platform/primitives"
import { storedAvatarAddress } from "@modules/integrations/object-storage"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { WorkspaceMemberEntity } from "./persistence/entities"
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

const toMember = (row: WorkspaceMemberEntity): WorkspaceMember => ({
    userId: row.userId,
    workspaceId: row.workspaceId,
    role: row.role,
    staffId: row.staffId,
    displayName: row.displayName,
    status: row.status,
})

/** The role a join names, held to the three the table allows (the table's own check would refuse any other). */
const roleOf = (value: string): WorkspaceRole => {
    if (value === "owner" || value === "manager" || value === "staff") return value
    throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.RoleInvalid, params: { role: value } })
}

/** The directory is bounded to the most members a workspace lists. */
const LIST_LIMIT = 500

/** The pictures `be_access.workspace_member_avatars` answers, one row per account that has one. */
interface MemberAvatarRow {
    readonly id: string
    readonly avatar_url: string | null
}

/** Owners first, then managers, then staff: the order the directory lists. */
const ROLE_RANK = "CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END"

/** The role a join writes over an existing seat: an owner is never demoted. */
const JOINED_ROLE = `CASE WHEN role = 'owner' THEN 'owner' ELSE :role END`

/** The staff link a join writes over an existing seat: a link is never dropped. */
const JOINED_STAFF = "coalesce(:staffId, staff_id)"

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
        private readonly staffNames: StaffDirectoryService,
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
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, { where: { workspaceId, userId } })
        const outcome = row === null ? refused(WorkspaceMembersErrorCode.NotMember) : admitMember(toMember(row), roles)
        return unwrapOutcome(outcome, WorkspaceMembersError)
    }

    /**
     * The member id (the seat) of the caller's active membership, or a typed refusal. Responsibilities, grants and the decision log
     * name this id, never the Auth user id and never a free-text name.
     */
    async idOf(userId: string, workspaceId: string): Promise<string> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: { id: true },
            where: { workspaceId, userId, status: "active" },
        })
        return unwrapOutcome(
            row === null ? refused(WorkspaceMembersErrorCode.NotMember) : ok(row.id),
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
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .where("m.workspaceId = :workspaceId", { workspaceId })
            .orderBy(ROLE_RANK)
            .addOrderBy("m.createdAt", "ASC")
            .addOrderBy("m.id", "ASC")
            .limit(LIST_LIMIT)
            .getMany()
        const avatars = await callDbFunction<MemberAvatarRow>(
            this.entityManager,
            "be_access.workspace_member_avatars",
            [workspaceId, rows.map((row) => row.userId)],
        )
        const avatarOf = new Map(avatars.map((avatar) => [avatar.id, avatar.avatar_url]))
        const showContact = isManagerRole(viewer.role)
        return Promise.all(
            rows.map(async (row) => {
                const account = showContact ? await this.accounts.accountOf(row.userId) : undefined
                const known = account?.kind === "ok" ? account.value : undefined
                return {
                    ...toMember(row),
                    avatarUrl: storedAvatarAddress(avatarOf.get(row.userId) ?? null),
                    email: known?.email ?? "",
                    lastSignInAt: known?.lastSignInAt ?? null,
                }
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
        await this.apply(() =>
            this.entityManager.update(WorkspaceMemberEntity, { workspaceId, userId: targetId }, { role }),
        )
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
        await this.apply(() =>
            this.entityManager.update(WorkspaceMemberEntity, { workspaceId, userId: targetId }, { status }),
        )
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
        await this.apply(() => this.entityManager.delete(WorkspaceMemberEntity, { workspaceId, userId: targetId }))
        await this.events.record({
            workspaceId,
            kind: "member.removed",
            actor: actor.displayName,
            summary: target.displayName,
        })
    }

    /** Saves the display name a person carries in every workspace they actively belong to. */
    async renameSelf(userId: string, displayName: string): Promise<void> {
        await this.entityManager.update(
            WorkspaceMemberEntity,
            { userId, status: "active" },
            { displayName: displayName.trim() },
        )
    }

    /** Creates or reactivates a membership; an owner is never demoted and a staff link is never dropped. */
    async join(entry: JoinEntry): Promise<void> {
        const [linked] = entry.staffId === null ? [] : await this.staffNames.namesOf(entry.workspaceId, [entry.staffId])
        const role = roleOf(entry.role)
        await this.entityManager.transaction(async (tx) => {
            await tx
                .createQueryBuilder(WorkspaceMemberEntity, "workspace_members")
                .insert()
                .values({
                    workspaceId: entry.workspaceId,
                    userId: entry.userId,
                    role,
                    staffId: entry.staffId,
                    displayName: linked?.name ?? entry.displayName,
                })
                .orIgnore()
                .execute()
            await tx
                .createQueryBuilder(WorkspaceMemberEntity, "workspace_members")
                .update()
                .set({ role: () => JOINED_ROLE, staffId: () => JOINED_STAFF, status: "active" })
                .where("workspace_id = :workspaceId AND user_id = :userId", {
                    workspaceId: entry.workspaceId,
                    userId: entry.userId,
                })
                .setParameters({ role, staffId: entry.staffId })
                .execute()
        })
    }

    /** An authenticated owner may add a missing seat; reruns retain existing state and refuse conflicting roles. */
    ensure(actorId: string, entry: JoinEntry): Promise<WorkspaceMember> {
        return this.entityManager.transaction(async (tx) => {
            const actor = await tx.findOne(WorkspaceMemberEntity, {
                where: { workspaceId: entry.workspaceId, userId: actorId },
                lock: { mode: "pessimistic_write" },
            })
            if (actor === null) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.NotMember })
            unwrapOutcome(admitMember(toMember(actor), ["owner"]), WorkspaceMembersError)
            await tx
                .createQueryBuilder(WorkspaceMemberEntity, "w")
                .insert()
                .values({
                    workspaceId: entry.workspaceId,
                    userId: entry.userId,
                    role: roleOf(entry.role),
                    staffId: entry.staffId,
                    displayName: entry.displayName,
                })
                .orIgnore()
                .execute()
            const row = await tx.findOne(WorkspaceMemberEntity, {
                where: { workspaceId: entry.workspaceId, userId: entry.userId },
            })
            if (row?.role !== entry.role || row.status !== "active")
                throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.EnsureConflict })
            return toMember(row)
        })
    }

    private async seats(actorId: string, workspaceId: string, targetId: string, rule: SeatRule): Promise<SeatPair> {
        const actor = await this.require(actorId, workspaceId, MANAGERS)
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            where: { workspaceId, userId: targetId },
        })
        if (row === null) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.MemberNotFound })
        const pair: SeatPair = { actor, target: toMember(row) }
        unwrapOutcome(judgeSeatChange(pair, rule), WorkspaceMembersError)
        return pair
    }

    private async apply(change: () => Promise<{ readonly affected?: number | null }>): Promise<void> {
        const changed = await change().catch((cause: unknown) => {
            if (isLastOwnerFailure(cause)) {
                throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.LastOwner, cause })
            }
            throw cause
        })
        if ((changed.affected ?? 0) === 0)
            throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.MemberNotFound })
    }
}
