import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { refused, unwrapOutcome } from "@modules/platform/primitives"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { MemberRow } from "./persistence/workspace-members.rows"
import { FIND_MEMBER, LIST_MEMBERS, UPSERT_MEMBER } from "./persistence/workspace-members.sql"
import { admitMember, isManagerRole } from "./role.policy"
import type {
    AccountDirectory,
    JoinEntry,
    MemberListing,
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

@Injectable()
/** Who belongs to which workspace and in which role; the only owner of workspace_members. */
export class WorkspaceMembersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
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
}
