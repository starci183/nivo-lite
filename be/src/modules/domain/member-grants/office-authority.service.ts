import { Injectable } from "@nestjs/common"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { RuleChange } from "@modules/domain/authority-rules"
import type { OfficeAuthorityPort, ResolvedOfficeAuthority } from "@modules/domain/workspace-seed"
import { eachInOrder } from "@modules/platform/primitives"
import type { MemberGrantChange } from "./member-grants.contracts"
import { MemberGrantsService } from "./member-grants.service"

/** One rule of an office seed. */
type OfficeRule = ResolvedOfficeAuthority["rules"][number]

/** One grant of an office seed. */
type OfficeGrant = ResolvedOfficeAuthority["grants"][number]

/** The rule change of a seeded rule: its mode follows its bands, and the approval settings are the seed's own. */
const ruleChangeOf = (rule: OfficeRule): RuleChange => ({
    action: rule.action,
    department: rule.department,
    mode: rule.auto_max === null ? "ask" : "auto",
    limit_vnd: null,
    required_fields: rule.required_fields,
    note: rule.note,
    unit: rule.unit,
    auto_max: rule.auto_max,
    ask_max: rule.ask_max,
    approver_roles: rule.approver_group.roles,
    approver_rooms: rule.approver_group.rooms,
    approver_members: rule.approver_group.members,
    approval_policy: rule.approval_policy,
    timeout_minutes: rule.timeout_minutes,
    agents: rule.agents,
})

/** The grants of a seed by action, in the order the actions first appear. */
const grantsByAction = (
    grants: ReadonlyArray<OfficeGrant>,
): ReadonlyArray<readonly [string, ReadonlyArray<MemberGrantChange>]> => {
    const byAction = new Map<string, Array<MemberGrantChange>>()
    grants.forEach((grant) => {
        const list = byAction.get(grant.action) ?? []
        list.push({ memberId: grant.member_id, maxAmount: grant.limit })
        byAction.set(grant.action, list)
    })
    return [...byAction.entries()]
}

@Injectable()
/**
 * The authority capability as the office seed (`seed-workspace office`) needs it: every rule of the story is saved through the
 * authority rules, with its bands and approver group, and the grants of each action are made exactly the story's. Both owners
 * prove what they are given (an action outside the registry, bands out of order, a member outside the workspace are refused).
 */
export class OfficeAuthorityService implements OfficeAuthorityPort {
    constructor(
        private readonly rules: AuthorityRulesService,
        private readonly grants: MemberGrantsService,
    ) {}

    /** Saves the rules, then the grants of each action. */
    async apply(workspaceId: string, authority: ResolvedOfficeAuthority): Promise<void> {
        await eachInOrder(authority.rules, async (rule) => {
            await this.rules.save(workspaceId, ruleChangeOf(rule))
        })
        await eachInOrder(grantsByAction(authority.grants), async ([action, grants]) => {
            await this.grants.replaceForAction(workspaceId, action, grants)
        })
    }
}
