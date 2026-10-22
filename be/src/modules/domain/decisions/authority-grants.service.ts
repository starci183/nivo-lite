import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { DirectoryMember, MemberGrant, MemberGrantChange } from "@modules/domain/member-grants"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WorkContext } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"

const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** Only the owner decides who may approve what: a manager could otherwise grant themselves the right. */
const OWNERS: ReadonlyArray<WorkspaceRole> = ["owner"]

@Injectable()
/** What the Quyen page reads and changes about who may approve what, for a caller who proves their membership. */
export class AuthorityGrantsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly grants: MemberGrantsService,
        private readonly actions: AuthorityActionsService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Everyone who may be named an approver, with the rooms they sit in; owner and manager only. */
    async listApprovers(principalId: string, workspaceId: string): Promise<ReadonlyArray<DirectoryMember>> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        return this.grants.directory(workspaceId)
    }

    /** What each member may approve for one action; owner and manager only. */
    async listMemberGrants(
        principalId: string,
        workspaceId: string,
        action: string,
    ): Promise<ReadonlyArray<MemberGrant>> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        return this.grants.forAction(workspaceId, action)
    }

    /**
     * Makes the approval limits of one action exactly the ones named: a member named gets their limit, a member not named loses
     * theirs. The owner only, and the registry has the last word on the action.
     */
    async saveMemberGrants(
        principalId: string,
        workspaceId: string,
        action: string,
        grants: ReadonlyArray<MemberGrantChange>,
    ): Promise<ReadonlyArray<MemberGrant>> {
        const member = await this.members.require(principalId, workspaceId, OWNERS)
        const known = (await this.actions.list(this.entityManager)).some((entry) => entry.action === action)
        if (!known) throw new DecisionsError({ code: DecisionsErrorCode.UnknownAction, params: { action } })
        const saved = await this.grants.replaceForAction(workspaceId, action, grants)
        await this.log(workspaceId, member, `${action}: ${saved.length}`)
        return saved
    }

    private async log(workspaceId: string, member: WorkspaceMember, summary: string): Promise<void> {
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale: "en" }
        await this.evidence.log(ctx, { kind: "authority.grants_updated", actor: member.displayName, summary })
    }
}
