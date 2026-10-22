import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AuthorityRuleRecord,
    DefaultRule,
    OptionalApprovalSetup,
    OptionalAuthorityRule,
    OptionalRuleAgent,
    OptionalRuleInstallation,
    RuleChange,
    RulesScope,
} from "./authority-rules.contracts"
import { AuthorityRulesError, AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import { applyOperatingMode } from "./operating-mode.policy"
import { appliesToAgent, judgeChange } from "./rule-settings.policy"
import type { ApprovalSetupRow, OperatingModeRow, RuleRecordRow, RuleRow } from "./persistence/authority-rules.rows"
import {
    FIND_APPROVAL_SETUP,
    FIND_OPERATING_MODE,
    FIND_RULE,
    LIST_RULES,
    SEED_DEFAULT_RULES,
    UPSERT_RULE,
} from "./persistence/authority-rules.sql"

@Injectable()
/** What the owner granted each action: the only owner of the authority_rules table. */
export class AuthorityRulesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The rule of an action with the operating mode applied: while the handling instance is in assist mode an "auto" rule
     * answers "ask". The rule is per module type; the operating mode is the handling instance's own, and a module with no
     * installation runs as autopilot. A rule that lists agents applies to those agents only: for any other agent it answers
     * null, as if the owner granted none. A caller that names no agent gets the rule whatever agents it lists.
     */
    async ruleFor(
        scope: RulesScope,
        action: string,
        installationId: OptionalRuleInstallation,
        agentId: OptionalRuleAgent = null,
    ): Promise<OptionalAuthorityRule> {
        const rule = (await this.entityManager.query<Array<RuleRow>>(FIND_RULE, [scope.workspaceId, action]))[0]
        if (rule === undefined || !appliesToAgent(rule.agents, agentId)) return null
        if (rule.mode !== "auto") return rule
        const installed = (
            await this.entityManager.query<Array<OperatingModeRow>>(FIND_OPERATING_MODE, [
                scope.workspaceId,
                rule.department,
                installationId,
            ])
        )[0]
        return applyOperatingMode(rule, installed?.operating_mode)
    }

    /** The approval side of the rule of an action, or null when the owner granted none. */
    async approvalSetup(workspaceId: string, action: string): Promise<OptionalApprovalSetup> {
        const row = (
            await this.entityManager.query<Array<ApprovalSetupRow>>(FIND_APPROVAL_SETUP, [workspaceId, action])
        )[0]
        if (row === undefined) return null
        return {
            department: row.department,
            action: row.action,
            mode: row.mode,
            unit: row.unit,
            auto_max: row.auto_max,
            ask_max: row.ask_max,
            group: { roles: row.approver_roles, rooms: row.approver_rooms, members: row.approver_members },
            policy: row.approval_policy,
            timeout_minutes: row.timeout_minutes,
            agents: row.agents,
        }
    }

    /** Every stored rule of the workspace. */
    list(workspaceId: string): Promise<ReadonlyArray<AuthorityRuleRecord>> {
        return this.entityManager.query<Array<RuleRecordRow>>(LIST_RULES, [workspaceId])
    }

    /**
     * Saves the rule of one action; an action the registry does not know, and approval settings that cannot hold (bands out of
     * order, an unknown policy, a time outside one minute to one week, a malformed group), are refused.
     */
    async save(workspaceId: string, change: RuleChange): Promise<AuthorityRuleRecord> {
        const judged = judgeChange(change)
        if (judged.kind === "refused") throw new AuthorityRulesError({ code: judged.code, params: judged.params })
        const saved = (
            await this.entityManager.query<Array<RuleRecordRow>>(UPSERT_RULE, [
                workspaceId,
                change.action,
                judged.value.mode,
                judged.value.limit_vnd,
                change.required_fields,
                change.department,
                change.note,
                JSON.stringify(judged.value.settings),
            ])
        )[0]
        if (saved === undefined) {
            throw new AuthorityRulesError({
                code: AuthorityRulesErrorCode.UnknownAction,
                params: { action: change.action },
            })
        }
        return saved
    }

    /** Grants the default rules of a module to the workspace; a rule the owner already set is never overwritten. */
    async seedDefaults(workspaceId: string, department: string, rules: ReadonlyArray<DefaultRule>): Promise<void> {
        await this.entityManager.query(SEED_DEFAULT_RULES, [workspaceId, department, JSON.stringify(rules)])
    }
}
