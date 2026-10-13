import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AuthorityRuleRecord,
    DefaultRule,
    OptionalAuthorityRule,
    OptionalRuleInstallation,
    RuleChange,
    RulesScope,
} from "./authority-rules.contracts"
import { AuthorityRulesError, AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import { applyOperatingMode } from "./operating-mode.policy"
import type { OperatingModeRow, RuleRecordRow, RuleRow } from "./persistence/authority-rules.rows"
import {
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
     * installation runs as autopilot.
     */
    async ruleFor(
        scope: RulesScope,
        action: string,
        installationId: OptionalRuleInstallation,
    ): Promise<OptionalAuthorityRule> {
        const rule = (await this.entityManager.query<Array<RuleRow>>(FIND_RULE, [scope.workspaceId, action]))[0]
        if (rule === undefined || rule.mode !== "auto") return rule ?? null
        const installed = (
            await this.entityManager.query<Array<OperatingModeRow>>(FIND_OPERATING_MODE, [
                scope.workspaceId,
                rule.department,
                installationId,
            ])
        )[0]
        return applyOperatingMode(rule, installed?.operating_mode)
    }

    /** Every stored rule of the workspace. */
    list(workspaceId: string): Promise<ReadonlyArray<AuthorityRuleRecord>> {
        return this.entityManager.query<Array<RuleRecordRow>>(LIST_RULES, [workspaceId])
    }

    /** Saves the rule of one action; an action the registry does not know is refused. */
    async save(workspaceId: string, change: RuleChange): Promise<AuthorityRuleRecord> {
        const saved = (
            await this.entityManager.query<Array<RuleRecordRow>>(UPSERT_RULE, [
                workspaceId,
                change.action,
                change.mode,
                change.limit_vnd,
                change.required_fields,
                change.department,
                change.note,
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
