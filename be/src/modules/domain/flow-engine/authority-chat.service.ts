import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityPatch, AuthorityProfile } from "@modules/domain/authority"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord, RuleMode } from "@modules/domain/authority-rules"
import { EvidenceService, ModuleCatalogService, formatVnd } from "@modules/domain/decisions"
import type { Proposal, WorkContext } from "@modules/domain/decisions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectDeepseekClient } from "@modules/integrations/deepseek"
import type { DeepseekClient } from "@modules/integrations/deepseek"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import {
    amountIn,
    appended,
    isThresholdSaid,
    modeOf,
    namesAction,
    namesOrder,
    saidOf,
    trimmed,
    wholeOf,
} from "./authority-chat.policy"
import { FlowEngineError, FlowEngineErrorCode } from "./errors/flow-engine.error"
import type { AuthorityChatAnswer } from "./flow-engine.contracts"

/** What the model read from the owner's message. */
type AuthorityChange = Awaited<ReturnType<DeepseekClient["parseAuthorityChat"]>>

/** One rule change of the model, with the limit the message may fill in. */
interface ModelRule {
    /** The action key. */
    readonly action: string
    /** The mode, or null for unchanged. */
    readonly mode: unknown
    /** The limit, VND, or null for unchanged. */
    readonly limit: number | null
}

/** One rule change the message asks for, checked against the catalogue. */
interface PlannedRule {
    /** The catalogue action. */
    readonly record: AuthorityActionRecord
    /** The new mode. */
    readonly mode: RuleMode
    /** The new limit, VND, or null for none. */
    readonly limit: number | null
    /** The stored rule, when there is one. */
    readonly existing: AuthorityRuleRecord | undefined
}

/** A rule as the decision log keeps it before and after a change. */
const proposalOfRule = (rule: AuthorityRuleRecord | undefined): Proposal | null =>
    rule === undefined
        ? null
        : { summary: `${rule.action}=${rule.mode}`, fields: { mode: rule.mode, limit_vnd: rule.limit_vnd } }

/** The letter the Vietnamese cards write after an amount (d with stroke). */
const DONG = String.fromCodePoint(0x111)

/** "5.000.000 d" with the dong sign in Vietnamese (what the owner reads on the cards), the locale currency otherwise. */
export const moneyOf = (amount: number, locale: Locale): string =>
    locale === "vi" ? `${new Intl.NumberFormat("vi-VN").format(amount)} ${DONG}` : formatVnd(amount, locale)

@Injectable()
/**
 * The owner grants authority in plain words: one model call reads goals, policies and rules from the message, and they are
 * saved through the owners of the authority sheet and the rules. Only the rules the owner actually named change; the model never
 * rewrites the whole table from a vague sentence. Callers prove the member is an owner or manager.
 */
export class AuthorityChatService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectDeepseekClient() private readonly ai: DeepseekClient,
        private readonly authority: AuthorityService,
        private readonly rules: AuthorityRulesService,
        private readonly actions: AuthorityActionsService,
        private readonly modules: ModuleCatalogService,
        private readonly evidence: EvidenceService,
    ) {}

    /** Reads the message, saves what it grants and answers what changed. */
    async apply(member: WorkspaceMember, text: string, locale: Locale): Promise<AuthorityChatAnswer> {
        const workspaceId = member.workspaceId
        const current = await this.authority.profileOf(workspaceId)
        const rules = await this.rules.list(workspaceId)
        const listed = rules
            .map((rule) => `${rule.action}=${rule.mode}${rule.limit_vnd === null ? "" : `(limit ${rule.limit_vnd})`}`)
            .join(", ")
        const change = await this.ai.parseAuthorityChat({ workspaceId, locale }, text, listed)
        const parts: Array<string> = []
        const patch = this.patchOf(change, current, locale, parts)
        const authority =
            Object.keys(patch).length > 0 ? await this.authority.save(workspaceId, patch, member.displayName) : current
        const changed = await this.saveRules(member, text, change, rules, locale, parts)
        if (parts.length === 0)
            return { summary: this.catalog.get("flowEngine.authorityNothing", {}, locale), authority, rules }
        const changes = parts.join("; ")
        const note = this.catalog.get("flowEngine.authorityDecisionNote", { changes }, locale)
        const ctx: WorkContext = { workspaceId, actor: member.displayName, locale }
        await Promise.all(
            changed.map((rule) =>
                this.evidence.decide(ctx, {
                    work_item_id: null,
                    lead_id: null,
                    department: rule.department,
                    action: rule.action,
                    decided_by: member.displayName,
                    decider_kind: "owner",
                    outcome: "edited",
                    note,
                    before: proposalOfRule(rules.find((stored) => stored.action === rule.action)),
                    after: proposalOfRule(rule),
                }),
            ),
        )
        await this.evidence.log(ctx, {
            kind: "authority.updated",
            actor: member.displayName,
            summary: note,
            evidence: text,
        })
        return {
            summary: this.catalog.get("flowEngine.authoritySaved", { changes }, locale),
            authority,
            rules: await this.rules.list(workspaceId),
        }
    }

    /** The authority sheet fields the message sets, with one line per change in `parts`. */
    private patchOf(
        change: AuthorityChange,
        current: AuthorityProfile | null,
        locale: Locale,
        parts: Array<string>,
    ): AuthorityPatch {
        const say = (key: string, params: Record<string, string | number> = {}): void => {
            parts.push(this.catalog.get(key, params, locale))
        }
        const revenue = wholeOf(change.goals.revenue_vnd)
        const customers = wholeOf(change.goals.new_customers)
        const reply = wholeOf(change.goals.first_reply_minutes)
        const note = trimmed(change.goals.note)
        const replyStyle = trimmed(change.reply_style)
        const brandVoice = trimmed(change.brand_voice)
        const limits = trimmed(change.limits_note_add)
        if (revenue !== null) say("flowEngine.goalRevenue", { amount: formatVnd(revenue, locale) })
        if (customers !== null) say("flowEngine.goalCustomers", { n: customers })
        if (reply !== null && reply > 0) say("flowEngine.goalReply", { n: reply })
        if (change.policies_add.length > 0) say("flowEngine.policies", { n: change.policies_add.length })
        if (replyStyle !== "") say("flowEngine.replyStyle")
        if (brandVoice !== "") say("flowEngine.brandVoice")
        if (limits !== "") say("flowEngine.limits")
        return {
            ...(revenue === null ? {} : { goal_revenue_vnd: revenue }),
            ...(customers === null ? {} : { goal_new_customers: customers }),
            ...(reply === null || reply <= 0 ? {} : { goal_first_reply_minutes: reply }),
            ...(note === "" ? {} : { goal_note: note }),
            ...(change.policies_add.length === 0 ? {} : { policies: appended(current?.policies, change.policies_add) }),
            ...(replyStyle === "" ? {} : { reply_style: replyStyle }),
            ...(brandVoice === "" ? {} : { brand_voice: brandVoice }),
            ...(limits === "" ? {} : { limits_note: appended(current?.limits_note, [limits]) }),
        }
    }

    /** Saves the rules the owner named and answers them; one line per change goes in `parts`. */
    private async saveRules(
        member: WorkspaceMember,
        text: string,
        change: AuthorityChange,
        stored: ReadonlyArray<AuthorityRuleRecord>,
        locale: Locale,
        parts: Array<string>,
    ): Promise<Array<AuthorityRuleRecord>> {
        const catalogue = new Map(
            (await this.actions.list(this.entityManager)).map((record) => [record.action, record] as const),
        )
        const said = saidOf(text)
        const amount = amountIn(said)
        const asked: Array<ModelRule> = change.rules.map((rule) => ({
            action: rule.action,
            mode: rule.mode ?? null,
            limit: rule.limit_vnd ?? null,
        }))
        // Deterministic backstop for the model: an order "below / over / up to 20 million" always carries the order limit.
        if (amount !== null && namesOrder(said) && !asked.some((rule) => rule.action === "confirm_order"))
            asked.push({ action: "confirm_order", mode: null, limit: amount })
        const planned = new Map<string, PlannedRule>()
        for (const rule of asked) {
            const record = catalogue.get(rule.action)
            if (record === undefined || !namesAction(said, record)) continue
            const limitAsked = record.amount_limit && rule.limit === null && amount !== null ? amount : rule.limit
            const existing = stored.find((x) => x.action === rule.action)
            // "orders over 20 million ask me" = do it alone strictly below 20M, ask otherwise.
            const mode: RuleMode =
                limitAsked !== null && isThresholdSaid(said) ? "auto" : (modeOf(rule.mode) ?? existing?.mode ?? "ask")
            const limit = limitAsked === null ? (existing?.limit_vnd ?? null) : wholeOf(limitAsked)
            planned.delete(rule.action)
            if (existing?.mode === mode && existing.limit_vnd === limit) continue
            planned.set(rule.action, { record, mode, limit, existing })
        }
        const plans = [...planned.values()]
        // An action the registry caps (publishing a video or a post) can never be set to run alone.
        const capped = plans.find((plan) => plan.mode === "auto" && plan.record.max_mode !== null)
        if (capped !== undefined)
            throw new FlowEngineError({
                code: FlowEngineErrorCode.ModeCapped,
                params: { action: capped.record.action },
            })
        const saved = await Promise.all(plans.map((plan) => this.saveRule(member.workspaceId, plan)))
        parts.push(...(await Promise.all(saved.map((rule, index) => this.ruleLine(rule, plans[index], locale)))))
        return saved
    }

    private saveRule(workspaceId: string, plan: PlannedRule): Promise<AuthorityRuleRecord> {
        return this.rules.save(workspaceId, {
            action: plan.record.action,
            department: plan.record.module_key,
            mode: plan.mode,
            limit_vnd: plan.limit,
            required_fields: plan.existing?.required_fields ?? [],
            note: null,
        })
    }

    private async ruleLine(rule: AuthorityRuleRecord, plan: PlannedRule | undefined, locale: Locale): Promise<string> {
        const line = this.catalog.get(
            "flowEngine.rule",
            {
                dept: await this.modules.nameOf(rule.department, locale),
                action: plan?.record.label[locale] ?? rule.action,
                mode: this.catalog.get(`flowEngine.mode.${rule.mode}`, {}, locale),
            },
            locale,
        )
        if (rule.limit_vnd === null || rule.mode !== "auto") return line
        const limit = this.catalog.get("flowEngine.ruleLimit", { amount: moneyOf(rule.limit_vnd, locale) }, locale)
        return `${line} (${limit})`
    }
}
