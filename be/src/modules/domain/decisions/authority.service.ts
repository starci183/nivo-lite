import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalAuthority, OptionalAuthorityRule, WorkContext } from "./decisions.contracts"
import { applyOperatingMode } from "./gate.policy"
import type { AuthorityRow, OperatingModeRow, RuleRow } from "./persistence/authority.rows"
import { FIND_AUTHORITY, FIND_OPERATING_MODE, FIND_RULE } from "./persistence/authority.sql"

@Injectable()
/** What the owner granted the agents: the house rules the prompts carry and the rule of each action. */
export class AuthorityService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The goals and house rules of the workspace; null before the owner set any. */
    async load(ctx: WorkContext): Promise<OptionalAuthority> {
        const row = (await this.entityManager.query<Array<AuthorityRow>>(FIND_AUTHORITY, [ctx.workspaceId]))[0]
        return row ?? null
    }

    /**
     * The rule of an action with the operating mode applied: while the handling instance is in assist mode an "auto" rule
     * answers "ask". The rule is per module type; the operating mode is the handling instance's own, and a module with no
     * installation runs as autopilot.
     */
    async ruleFor(ctx: WorkContext, action: string, installationId: string | null): Promise<OptionalAuthorityRule> {
        const rule = (await this.entityManager.query<Array<RuleRow>>(FIND_RULE, [ctx.workspaceId, action]))[0]
        if (rule === undefined || rule.mode !== "auto") return rule ?? null
        const installed = (
            await this.entityManager.query<Array<OperatingModeRow>>(FIND_OPERATING_MODE, [
                ctx.workspaceId,
                rule.department,
                installationId,
            ])
        )[0]
        return applyOperatingMode(rule, installed?.operating_mode)
    }
}
