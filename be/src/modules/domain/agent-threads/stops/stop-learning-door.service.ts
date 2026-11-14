import { Inject, Injectable, Optional } from "@nestjs/common"
import { AgentViewScopeService } from "@modules/domain/agents"
import { BrainChangeRequestsService, BrainFactsService, type Evidence, type FactStatus, type MaybeFact } from "@modules/domain/brain-facts"
import {
    STOP_LEARNING_CARDS,
    type ChangeCardPoster,
    type LearningChange,
    type LearningChangeDoor,
    type LearningChangePosted,
    type LearningChangeState,
} from "./stop-learning.contracts"

/** The source a learned truth files under: the shop's own people's words, relayed by an agent (as a chat change request). */
const RELAYED = "staff"

/** Who proposes a learned truth. */
const PROPOSER = "NIVO"

/** The statuses of a fact that mean the founder's yes. */
const APPLIED: ReadonlySet<FactStatus> = new Set<FactStatus>(["active", "scheduled", "superseded", "expired"])

/** The longest quote a fact's evidence keeps. */
const QUOTE_MAX = 500

@Injectable()
/**
 * The learning's door to the truth graph: files the drafted truth as a PROPOSAL of the store (never applied: `autoApply: false`, the
 * founder decides) with the answered stops as its evidence, then posts its one `brain.change` card (origin `learning`) through BG4's
 * poster into the founder's direct room with the agent that asked. A value the truth already holds is not posted (`already_true`).
 * The state of a change is read back from the store, so a decision taken on the card or on the Second Brain page is seen alike.
 */
export class StopLearningDoorService implements LearningChangeDoor {
    constructor(
        private readonly facts: BrainFactsService,
        @Optional() @Inject(STOP_LEARNING_CARDS) private readonly cards?: ChangeCardPoster,
        @Optional() private readonly changes?: BrainChangeRequestsService,
        @Optional() private readonly scopes?: AgentViewScopeService,
    ) {}

    /** Whether the app wired a card poster: without it, answers are kept and nothing is posted. */
    available(): boolean {
        return this.cards !== undefined
    }

    /** Files the drafted truth as a proposal with its evidence and posts its one `brain.change` card to the founder. */
    async post(change: LearningChange): Promise<LearningChangePosted> {
        const evidence: Array<Evidence> = change.evidence.map((one) => ({
            kind: "decision",
            ref: one.ref,
            label: one.by.name,
            quote: one.quote.slice(0, QUOTE_MAX),
            at: one.at,
        }))
        // A learned truth is the whole shop's (FX6): filed workspace-wide, unless it changes a value kept for the asking agent's own
        // instance, which it then replaces in that scope (the next version of THAT fact, never a second value beside it).
        const replaced = await this.replacedOf(change)
        const { fact } = await this.facts.propose(change.workspaceId, {
            subjectLabel: replaced?.subjectLabel ?? change.factKey.subjectLabel,
            attributeLabel: replaced?.attributeLabel ?? change.factKey.attributeLabel,
            installationId: replaced?.installationId ?? null,
            value: change.newValue,
            unit: change.unit,
            sourceKind: RELAYED,
            validFrom: change.validity?.from ?? null,
            validTo: change.validity?.to ?? null,
            evidence,
            proposedBy: PROPOSER,
            autoApply: false,
        })
        if (fact.status !== "proposed") return { changeId: fact.id, state: "already_true" }
        if (this.cards === undefined) return { changeId: fact.id, state: "not_posted" }
        const posted = await this.cards.post({
            workspaceId: change.workspaceId,
            changeId: fact.id,
            origin: "learning",
            reason: change.reason,
            evidence: change.evidence.map((one) => ({ kind: one.kind, quote: one.quote, ref: one.ref, by: one.by, at: one.at })),
            agentId: change.agentId,
            roomId: null,
        })
        if (posted.outcome === "posted" || posted.outcome === "updated") return { changeId: fact.id, state: "open" }
        return { changeId: fact.id, state: posted.outcome === "not_waiting" ? "already_true" : "not_posted" }
    }

    /**
     * The fact in force the learned truth changes, when the asking agent is one instance of a multi-instance type: that instance's own
     * value of the key, else the workspace-wide one (the change requests' rule). Undefined for a single-instance agent (the store's
     * workspace-wide key decides) or an app without the readers: null.
     */
    private async replacedOf(change: LearningChange): Promise<MaybeFact> {
        if (this.scopes === undefined || this.changes === undefined) return null
        const installationId = (await this.scopes.lensOf(change.workspaceId, change.agentId))?.installationId ?? null
        if (installationId === null) return null
        return this.changes.replacedFor(change.workspaceId, change.factKey, installationId)
    }

    /** Where a posted change stands, read back from the truth store. */
    async stateOf(workspaceId: string, changeId: string): Promise<LearningChangeState> {
        const fact = await this.facts.get(workspaceId, changeId)
        if (fact === null) return "gone"
        if (fact.status === "proposed") return "open"
        return APPLIED.has(fact.status) ? "applied" : "rejected"
    }
}
