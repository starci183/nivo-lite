import { Injectable } from "@nestjs/common"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import { BrainFactsService, keyOf, sameValue } from "@modules/domain/brain-facts"
import type { Evidence } from "@modules/domain/brain-facts"
import { EventsService } from "@modules/domain/events"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { SetupWritesService } from "@modules/domain/module-setup-writes"
import type {
    CardRecord,
    FactCardPayload,
    ProposedCardRecord,
    RuleCardPayload,
} from "@modules/domain/module-setup-writes"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Locale } from "@modules/platform/i18n"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { CardDecision, CurrentFact, CurrentRule, SetupCardView } from "./module-setup.contracts"
import type { ModuleDefinition } from "./modules.contracts"
import { ModulesService } from "./modules.service"
import { cardOf } from "./policies/setup-writes.policy"
import type { OpenGap, ProposedWrite } from "./policies/setup-writes.policy"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
const GAPS_PER_TURN = 5

/** The rule of an action as it stands: the stored row, else what installing the module grants. */
interface RuleInForce {
    readonly mode: RuleCardPayload["mode"]
    readonly limitVnd: number | null
    readonly requiredFields: ReadonlyArray<string>
}

@Injectable()
/**
 * The confirm cards of the setup chat: the owner answers become cards (a Second Brain fact or an authority rule) that are written only
 * when the owner confirms them, with their edits, on the card.
 */
export class SetupCardsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly writes: SetupWritesService,
        private readonly sessions: SetupSessionsService,
        private readonly messages: SetupMessagesService,
        private readonly installations: InstallationRecordsService,
        private readonly members: WorkspaceMembersService,
        private readonly modules: ModulesService,
        private readonly facts: BrainFactsService,
        private readonly rules: AuthorityRulesService,
        private readonly gaps: KnowledgeGapsService,
        private readonly events: EventsService,
        private readonly sync: AgentSyncService,
    ) {}

    /** The cards of the given sessions, each waiting one with the value it would replace. */
    async viewsOf(workspaceId: string, sessionIds: ReadonlyArray<string>): Promise<ReadonlyArray<SetupCardView>> {
        const cards = await this.writes.ofSessions(sessionIds)
        if (cards.length === 0) return []
        const stored = await this.rules.list(workspaceId)
        const catalog = await this.modules.catalog()
        return Promise.all(
            cards.map(async (card) => ({
                card,
                current:
                    card.status === "proposed"
                        ? await this.currentOf(workspaceId, card, stored, catalog.modules)
                        : null,
            })),
        )
    }

    /** The open customer questions of a module, most asked first. */
    async openGapsOf(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<OpenGap>> {
        const open = await this.gaps.list(workspaceId, ["open"], 100)
        return open
            .filter((gap) => gap.module === moduleKey)
            .slice(0, GAPS_PER_TURN)
            .map((gap) => ({
                id: gap.id,
                question: gap.question,
                topic: gap.topic,
                attributeGuess: gap.attributeGuess,
                count: gap.count,
            }))
    }

    /**
     * Stores the writes a turn proposed as confirm cards. A rule card is completed with the half the owner did not change (mode or
     * limit) from the rule in force; a rule that would change nothing is dropped. A waiting card for the same target is replaced.
     */
    async propose(
        workspaceId: string,
        sessionId: string,
        sourceMessageId: string,
        proposed: ReadonlyArray<ProposedWrite>,
    ): Promise<void> {
        const stored = await this.rules.list(workspaceId)
        const catalog = await this.modules.catalog()
        const cards: Array<ProposedCardRecord> = []
        for (const write of proposed) {
            if (write.kind === "fact") {
                cards.push(cardOf(write, write.payload))
                continue
            }
            const have = this.ruleInForce(write.payload.action, stored, catalog.modules)
            const mode = write.payload.mode ?? have.mode
            const limitVnd = write.payload.limitVnd === undefined ? have.limitVnd : write.payload.limitVnd
            if (mode === have.mode && limitVnd === have.limitVnd) continue
            cards.push(cardOf(write, { action: write.payload.action, field: write.payload.field, mode, limitVnd }))
        }
        await this.writes.propose(workspaceId, sessionId, sourceMessageId, cards)
    }

    /**
     * The owner decides one card. Reject: nothing is written. Confirm (with the edits of the owner, if any): a fact goes to the Second
     * Brain as a statement of the owner, restricted facts limited to this module; if a different value is in force the owner must have
     * chosen to replace it (history kept), keep it, or keep both for a named situation. A rule is saved like the Authority page does.
     */
    async decide(
        principalId: string,
        workspaceId: string,
        cardId: string,
        change: CardDecision,
        locale: Locale,
    ): Promise<CardRecord> {
        const member = await this.members.require(principalId, workspaceId, GOVERNORS)
        const card = await this.writes.find(workspaceId, cardId)
        if (card === null) throw new ModulesError({ code: ModulesErrorCode.CardNotFound })
        if (card.status !== "proposed") throw new ModulesError({ code: ModulesErrorCode.CardDecided })
        const session = await this.sessions.find(workspaceId, card.setupSessionId)
        const installation =
            session === null ? null : await this.installations.find(workspaceId, session.installationId)
        if (installation === null) throw new ModulesError({ code: ModulesErrorCode.InstallationNotFound })
        const module = await this.modules.find(installation.moduleKey)
        const close = async (
            status: "applied" | "rejected",
            payload: FactCardPayload | RuleCardPayload,
            result: CardRecord["result"] & object,
        ): Promise<CardRecord> => {
            const closed = await this.writes.close(workspaceId, cardId, {
                status,
                payload,
                result,
                decidedBy: member.displayName,
            })
            if (closed === null) throw new ModulesError({ code: ModulesErrorCode.CardDecided })
            return closed
        }
        if (change.decision === "reject") return close("rejected", card.payload, { outcome: "rejected" })
        if (card.kind === "rule") {
            return this.confirmRule(workspaceId, member.displayName, module, card.payload, change, locale, close)
        }
        return this.confirmFact(workspaceId, member.displayName, module, installation, card, change, locale, close)
    }

    private async confirmRule(
        workspaceId: string,
        actor: string,
        module: ModuleDefinition,
        base: RuleCardPayload,
        change: CardDecision,
        locale: Locale,
        close: (
            status: "applied" | "rejected",
            payload: FactCardPayload | RuleCardPayload,
            result: NonNullable<CardRecord["result"]>,
        ) => Promise<CardRecord>,
    ): Promise<CardRecord> {
        const mode = change.mode ?? base.mode
        const limitVnd = change.limitVnd === undefined ? base.limitVnd : change.limitVnd
        const have = this.ruleInForce(
            base.action,
            await this.rules.list(workspaceId),
            (await this.modules.catalog()).modules,
        )
        const definition = module.authorityActions.find((candidate) => candidate.action === base.action)
        const saved = await this.rules.save(workspaceId, {
            action: base.action,
            department: module.key,
            mode,
            limit_vnd: definition?.amountLimit === true ? limitVnd : null,
            required_fields: have.requiredFields,
            note: null,
        })
        const limit = saved.limit_vnd === null ? "" : ` < ${saved.limit_vnd}`
        await this.events.record({
            workspaceId,
            kind: "authority.rule_updated",
            actor,
            summary: `${module.key}.${base.action} -> ${mode}${limit} (${module.name[locale]} setup chat)`,
        })
        return close("applied", { ...base, mode, limitVnd: saved.limit_vnd }, { outcome: "applied", ruleId: saved.id })
    }

    private async confirmFact(
        workspaceId: string,
        actor: string,
        module: ModuleDefinition,
        installation: InstallationRecord,
        card: CardRecord & { readonly kind: "fact" },
        change: CardDecision,
        locale: Locale,
        close: (
            status: "applied" | "rejected",
            payload: FactCardPayload | RuleCardPayload,
            result: NonNullable<CardRecord["result"]>,
        ) => Promise<CardRecord>,
    ): Promise<CardRecord> {
        const base = card.payload
        const value = (change.value ?? base.value).trim()
        const scope = change.scope ?? base.scope
        const subjectLabel = (change.subjectLabel ?? base.subjectLabel).trim()
        const baseAttribute = (change.attributeLabel ?? base.attributeLabel).trim()
        if (value === "" || subjectLabel === "" || baseAttribute === "") {
            throw new ModulesError({ code: ModulesErrorCode.CardFactIncomplete })
        }
        const scopeId = change.onlyThisAgent === true && installation.isMulti ? installation.id : null
        const [current] = await this.facts.byKey(
            workspaceId,
            keyOf(subjectLabel),
            keyOf(baseAttribute),
            "active",
            scopeId,
        )
        const conflict = current !== undefined && !sameValue(current.value, value)
        if (conflict && change.resolution === undefined) {
            throw new ModulesError({ code: ModulesErrorCode.CardNeedsResolution })
        }
        const resolution = conflict ? change.resolution : undefined
        const edited: FactCardPayload = { ...base, subjectLabel, attributeLabel: baseAttribute, value, scope }
        if (resolution === "keep") return close("rejected", edited, { outcome: "kept_current", resolution })
        const situation = (change.situation ?? "").trim()
        if (resolution === "both" && situation === "") {
            throw new ModulesError({ code: ModulesErrorCode.CardNeedsSituation })
        }
        const attributeLabel = resolution === "both" ? `${baseAttribute} (${situation})`.slice(0, 120) : baseAttribute
        const source =
            card.sourceMessageId === null ? null : await this.messages.find(workspaceId, card.sourceMessageId)
        const evidence: Evidence = {
            kind: "message",
            ref: card.sourceMessageId ?? `setup:${card.setupSessionId}`,
            label: `${module.name[locale]} - setup chat (${card.gateKey})`,
            ...(source === null ? {} : { quote: source.body.slice(0, 300) }),
            at: this.clock.now().toISOString(),
        }
        const { fact, outcome } = await this.facts.propose(workspaceId, {
            subjectType: base.subjectType,
            subjectLabel,
            attributeLabel,
            value,
            scope,
            modules: scope === "restricted" ? [module.key] : [],
            sourceKind: "owner",
            proposedBy: actor,
            evidence: [evidence],
            installationId: scopeId,
        })
        if (fact.status !== "active") throw new ModulesError({ code: ModulesErrorCode.CardFactNotApplied })
        if (base.gapId !== undefined) await this.gaps.answer(workspaceId, base.gapId, `fact:${fact.id}`)
        await this.sync.requestNow({ workspaceId, installationId: null, force: false })
        return close(
            "applied",
            { ...edited, attributeLabel },
            { outcome, factId: fact.id, ...(resolution === undefined ? {} : { resolution }) },
        )
    }

    private async currentOf(
        workspaceId: string,
        card: CardRecord,
        stored: ReadonlyArray<AuthorityRuleRecord>,
        catalog: ReadonlyArray<ModuleDefinition>,
    ): Promise<CurrentFact | CurrentRule | null> {
        if (card.kind === "rule") {
            const have = this.ruleInForce(card.payload.action, stored, catalog)
            return { kind: "rule", mode: have.mode, limitVnd: have.limitVnd }
        }
        const { subjectLabel, attributeLabel } = card.payload
        const [active] = await this.facts.byKey(workspaceId, keyOf(subjectLabel), keyOf(attributeLabel), "active", null)
        return active === undefined
            ? null
            : { kind: "fact", value: active.value, scope: active.scope, modules: active.modules }
    }

    private ruleInForce(
        action: string,
        stored: ReadonlyArray<AuthorityRuleRecord>,
        catalog: ReadonlyArray<ModuleDefinition>,
    ): RuleInForce {
        const rule = stored.find((candidate) => candidate.action === action)
        if (rule !== undefined) {
            return { mode: rule.mode, limitVnd: rule.limit_vnd, requiredFields: rule.required_fields }
        }
        const definition = catalog
            .flatMap((module) => module.authorityActions)
            .find((candidate) => candidate.action === action)
        return {
            mode: definition?.mode ?? "ask",
            limitVnd: definition?.limitVnd ?? null,
            requiredFields: definition?.requiredFields ?? [],
        }
    }
}
