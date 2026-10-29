import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityActionEntity } from "@modules/domain/authority-actions"
import { ModuleInstallationEntity } from "@modules/domain/module-installations"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AuthorityRuleRecord,
    DefaultRule,
    OptionalApprovalSetup,
    OptionalAuthorityRule,
    OptionalRuleAgent,
    OptionalRuleInstallation,
    RuleChange,
    RuleSettingsPatch,
    RulesScope,
} from "./authority-rules.contracts"
import { toApprovalSetup, toRule, toRuleRecord } from "./authority-rules.mapper"
import { AuthorityRulesError, AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import { applyOperatingMode } from "./operating-mode.policy"
import { AuthorityRuleEntity } from "./persistence/entities"
import { appliesToAgent, judgeChange } from "./rule-settings.policy"

/** The columns an upsert answers, named as the entity properties so the answer reads as an entity. */
const RETURNED = [
    "id",
    'workspace_id AS "workspaceId"',
    "department",
    "action",
    "mode",
    'limit_vnd::float8 AS "limitVnd"',
    'required_fields AS "requiredFields"',
    "note",
    'updated_at AS "updatedAt"',
    "unit",
    'auto_max::float8 AS "autoMax"',
    'ask_max::float8 AS "askMax"',
    "agents::text[] AS agents",
    'approver_roles AS "approverRoles"',
    'approver_rooms AS "approverRooms"',
    'approver_members::text[] AS "approverMembers"',
    'approval_policy AS "approvalPolicy"',
    'timeout_minutes AS "timeoutMinutes"',
].join(", ")

/** True when a RETURNING row names the key of a stored rule, the shape the returned columns give it. */
const isAuthorityRuleEntity = (value: unknown): value is AuthorityRuleEntity =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The rows a write answered. */
const returnedRules = (raw: unknown): Array<AuthorityRuleEntity> =>
    Array.isArray(raw) ? raw.filter(isAuthorityRuleEntity) : []
/** The columns an upsert replaces when the rule exists: the always-saved ones, the note when one was given, and the named settings. */
const overwrittenColumns = (note: string | null, settings: RuleSettingsPatch): Array<string> => {
    const named: ReadonlyArray<readonly [string, unknown]> = [
        ["unit", settings.unit],
        ["auto_max", settings.auto_max],
        ["ask_max", settings.ask_max],
        ["approver_roles", settings.approver_roles],
        ["approver_rooms", settings.approver_rooms],
        ["approver_members", settings.approver_members],
        ["approval_policy", settings.approval_policy],
        ["timeout_minutes", settings.timeout_minutes],
        ["agents", settings.agents],
    ]
    return [
        "mode",
        "limit_vnd",
        "required_fields",
        "updated_at",
        ...(note === null ? [] : ["note"]),
        ...named.flatMap(([column, value]) => (value === undefined ? [] : [column])),
    ]
}

/** The entity values of the settings the caller named; a new rule takes the table default for the rest. */
const namedSettings = (settings: RuleSettingsPatch): Partial<AuthorityRuleEntity> => ({
    ...(settings.unit === undefined ? {} : { unit: settings.unit }),
    ...(settings.auto_max === undefined ? {} : { autoMax: settings.auto_max }),
    ...(settings.ask_max === undefined ? {} : { askMax: settings.ask_max }),
    ...(settings.approver_roles === undefined ? {} : { approverRoles: [...settings.approver_roles] }),
    ...(settings.approver_rooms === undefined ? {} : { approverRooms: [...settings.approver_rooms] }),
    ...(settings.approver_members === undefined ? {} : { approverMembers: [...settings.approver_members] }),
    ...(settings.approval_policy === undefined ? {} : { approvalPolicy: settings.approval_policy }),
    ...(settings.timeout_minutes === undefined ? {} : { timeoutMinutes: settings.timeout_minutes }),
    ...(settings.agents === undefined ? {} : { agents: [...settings.agents] }),
})

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
        const stored = await this.entityManager.findOne(AuthorityRuleEntity, {
            where: { workspaceId: scope.workspaceId, action },
        })
        if (stored === null || !appliesToAgent(stored.agents, agentId)) return null
        const rule = toRule(stored)
        if (rule.mode !== "auto") return rule
        // The handling instance: the named one, else the oldest of the module.
        const installed = this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .select("i.operating_mode", "operatingMode")
            .where("i.workspace_id = :workspaceId AND i.module_key = :department", {
                workspaceId: scope.workspaceId,
                department: stored.department,
            })
        if (installationId !== null) installed.andWhere("i.id = :installationId", { installationId })
        const mode = await installed
            .orderBy("i.created_at", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(1)
            .getRawOne<{ operatingMode: string }>()
        return applyOperatingMode(rule, mode?.operatingMode)
    }

    /** The approval side of the rule of an action, or null when the owner granted none. */
    async approvalSetup(workspaceId: string, action: string): Promise<OptionalApprovalSetup> {
        const stored = await this.entityManager.findOne(AuthorityRuleEntity, { where: { workspaceId, action } })
        return stored === null ? null : toApprovalSetup(stored)
    }

    /** Every stored rule of the workspace. */
    list(workspaceId: string): Promise<ReadonlyArray<AuthorityRuleRecord>> {
        return this.entityManager
            .find(AuthorityRuleEntity, {
                where: { workspaceId },
                order: { department: "ASC", action: "ASC" },
                take: 500,
            })
            .then((rows) => rows.map(toRuleRecord))
    }

    /**
     * Saves the rule of one action; an action the registry does not know, and approval settings that cannot hold (bands out of
     * order, an unknown policy, a time outside one minute to one week, a malformed group), are refused.
     */
    async save(workspaceId: string, change: RuleChange): Promise<AuthorityRuleRecord> {
        const judged = judgeChange(change)
        if (judged.kind === "refused") throw new AuthorityRulesError({ code: judged.code, params: judged.params })
        const settings = judged.value.settings
        const unknown = (): AuthorityRulesError =>
            new AuthorityRulesError({ code: AuthorityRulesErrorCode.UnknownAction, params: { action: change.action } })
        const record = await this.entityManager.transaction(async (manager) => {
            // The department must be the module the registry gives the action, so a mismatched pair stores nothing.
            const registered = await manager
                .createQueryBuilder(AuthorityActionEntity, "a")
                .select("a.action")
                .where("a.action = :action AND a.moduleKey = :department", {
                    action: change.action,
                    department: change.department,
                })
                .setLock("pessimistic_read")
                .getOne()
            if (registered === null) throw unknown()
            // Only the settings the caller named replace what is stored; a new rule takes the table default for the rest.
            const overwritten = overwrittenColumns(change.note, settings)
            const saved = await manager
                .createQueryBuilder(AuthorityRuleEntity, "ar")
                .insert()
                .values({
                    workspaceId,
                    department: change.department,
                    action: change.action,
                    mode: judged.value.mode,
                    limitVnd: judged.value.limit_vnd,
                    requiredFields: [...change.required_fields],
                    note: change.note ?? "",
                    updatedAt: () => "now()",
                    ...namedSettings(settings),
                })
                .orUpdate(overwritten, ["workspace_id", "department", "action"])
                .returning(RETURNED)
                .execute()
            const [row] = returnedRules(saved.raw)
            if (row === undefined) throw unknown()
            return toRuleRecord(row)
        })
        return record
    }

    /** Switches off the rules a removed agent was granted, inside the caller's transaction. */
    async disableForAgent(workspaceId: string, agentId: string, manager: EntityManager): Promise<void> {
        // A rule that lists the agent among others only loses it; one that listed it alone stays but never acts.
        await manager
            .createQueryBuilder(AuthorityRuleEntity, "ar")
            .update()
            .set({
                mode: () => "CASE WHEN agents = ARRAY[:agentId::uuid] THEN 'never' ELSE mode END",
                agents: () =>
                    "CASE WHEN agents = ARRAY[:agentId::uuid] THEN agents ELSE array_remove(agents, :agentId::uuid) END",
                updatedAt: () => "now()",
            })
            .where("workspace_id = :workspaceId AND :agentId::uuid = ANY(agents)", { workspaceId, agentId })
            .execute()
    }

    /** Grants the default rules of a module to the workspace; a rule the owner already set is never overwritten. */
    async seedDefaults(workspaceId: string, department: string, rules: ReadonlyArray<DefaultRule>): Promise<void> {
        if (rules.length === 0) return
        await this.entityManager
            .createQueryBuilder(AuthorityRuleEntity, "ar")
            .insert()
            .values(
                rules.map((rule) => ({
                    workspaceId,
                    department,
                    action: rule.action,
                    mode: rule.mode,
                    limitVnd: rule.limit_vnd,
                    requiredFields: [...rule.required_fields],
                })),
            )
            .orIgnore()
            .execute()
    }
}
