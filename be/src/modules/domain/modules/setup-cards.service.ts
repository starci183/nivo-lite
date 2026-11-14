import { Injectable } from "@nestjs/common"
import { BrainFactsService, factSlugOf, sameValue, type Evidence, type Scope } from "@modules/domain/brain-facts"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { SetupWritesService, type CardRecord, type FactCardPayload } from "@modules/domain/module-setup-writes"
import { InstallationChangesService } from "./installation-changes.service"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { Locale } from "@modules/platform/i18n"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import type { CardDecision, CurrentFact, SetupCardView } from "./module-setup.contracts"
import type { ModuleDefinition } from "./modules.contracts"
import { ModulesService } from "./modules.service"
import { cardOf, type OpenGap, type ProposedFact } from "./policies/setup-writes.policy"

const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]
const SCOPES: ReadonlySet<Scope> = new Set(["public", "internal", "restricted"])
const GAPS_PER_TURN = 5

const factScopeOf = (scope: Scope | undefined, fallback: Scope): Scope =>
    scope !== undefined && SCOPES.has(scope) ? scope : fallback

/** Closes a decided setup card with its resulting payload. */
type CardCloser = (
    status: "applied" | "rejected",
    payload: FactCardPayload,
    result: NonNullable<CardRecord["result"]>,
) => Promise<CardRecord>

/** The authority and selected fact card for confirmation. */
interface ConfirmFactParams {
    readonly workspaceId: string
    readonly actor: string
    readonly module: ModuleDefinition
    readonly installation: InstallationRecord
    readonly card: CardRecord & { readonly kind: "fact" }
    readonly change: CardDecision
    readonly locale: Locale
    readonly close: CardCloser
}

@Injectable()
/**
 * The confirm cards of the setup chat: the owner answers become Second Brain fact cards that are written only when the owner confirms
 * them, with their edits, on the card (rule and branch cards are gone with the authority rules, 2026-11-13).
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
        private readonly gaps: KnowledgeGapsService,
        private readonly changes: InstallationChangesService,
    ) {}

    /** The cards of the given sessions, each waiting one with the value it would replace. */
    async viewsOf(workspaceId: string, sessionIds: ReadonlyArray<string>): Promise<ReadonlyArray<SetupCardView>> {
        const cards = await this.writes.ofSessions(sessionIds)
        return Promise.all(
            cards.map(async (card) => ({
                card,
                current: card.status === "proposed" ? await this.currentOf(workspaceId, card) : null,
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

    /** Stores the fact writes a turn proposed as confirm cards; a waiting card for the same target is replaced. */
    async propose(
        workspaceId: string,
        sessionId: string,
        sourceMessageId: string,
        proposed: ReadonlyArray<ProposedFact>,
    ): Promise<void> {
        await this.writes.propose(
            workspaceId,
            sessionId,
            sourceMessageId,
            proposed.map((write) => cardOf(write, write.payload)),
        )
    }

    /**
     * The owner decides one card. Reject: nothing is written. Confirm (with the edits of the owner, if any): a fact goes to the Second
     * Brain as a statement of the owner, restricted facts limited to this module; if a different value is in force the owner must have
     * chosen to replace it (history kept), keep it, or keep both for a named situation.
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
            payload: FactCardPayload,
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
        return this.confirmFact({
            workspaceId,
            actor: member.displayName,
            module,
            installation,
            card,
            change,
            locale,
            close,
        })
    }

    private async confirmFact(params: ConfirmFactParams): Promise<CardRecord> {
        const { workspaceId, actor, module, installation, card, change, locale, close } = params
        const base = card.payload
        const value = (change.value ?? base.value).trim()
        const scope = factScopeOf(change.scope, base.scope)
        const subjectLabel = (change.subjectLabel ?? base.subjectLabel).trim()
        const baseAttribute = (change.attributeLabel ?? base.attributeLabel).trim()
        if (value === "" || subjectLabel === "" || baseAttribute === "") {
            throw new ModulesError({ code: ModulesErrorCode.CardFactIncomplete })
        }
        const scopeId = change.onlyThisAgent === true && installation.isMulti ? installation.id : null
        const [current] = await this.facts.byKey(
            workspaceId,
            factSlugOf(subjectLabel),
            factSlugOf(baseAttribute),
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
        const evidence = await this.factEvidence(workspaceId, card, module, locale)
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
        await this.changes.announceNow({ workspaceId, installationId: null, force: false })
        return close(
            "applied",
            { ...edited, attributeLabel },
            { outcome, factId: fact.id, ...(resolution === undefined ? {} : { resolution }) },
        )
    }

    private async factEvidence(
        workspaceId: string,
        card: CardRecord,
        module: ModuleDefinition,
        locale: Locale,
    ): Promise<Evidence> {
        const source =
            card.sourceMessageId === null ? null : await this.messages.find(workspaceId, card.sourceMessageId)
        return {
            kind: "message",
            ref: card.sourceMessageId ?? `setup:${card.setupSessionId}`,
            label: `${module.name[locale]} - setup chat (${card.gateKey})`,
            ...(source === null ? {} : { quote: source.body.slice(0, 300) }),
            at: this.clock.now().toISOString(),
        }
    }

    private async currentOf(workspaceId: string, card: CardRecord): Promise<CurrentFact | null> {
        const { subjectLabel, attributeLabel } = card.payload
        const [active] = await this.facts.byKey(
            workspaceId,
            factSlugOf(subjectLabel),
            factSlugOf(attributeLabel),
            "active",
            null,
        )
        return active === undefined
            ? null
            : { kind: "fact", value: active.value, scope: active.scope, modules: active.modules }
    }
}
