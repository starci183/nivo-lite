import { Inject, Injectable, Optional } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { Evidence, FactStatus } from "@modules/domain/brain-facts"
import { STOP_LEARNING_CARDS } from "./stop-learning.contracts"
import type {
    ChangeCardPoster,
    LearningChange,
    LearningChangeDoor,
    LearningChangePosted,
    LearningChangeState,
} from "./stop-learning.contracts"

/** The source a learned truth files under: the shop's own people's words, relayed by an agent (as a chat change request). */
const RELAYED = "staff"

/** Who proposes a learned truth. */
const PROPOSER = "NIVO"

/** The statuses of a fact that mean the founder's yes. */
const APPLIED: ReadonlyArray<FactStatus> = ["active", "scheduled", "superseded", "expired"]

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
    ) {}

    available(): boolean {
        return this.cards !== undefined
    }

    async post(change: LearningChange): Promise<LearningChangePosted> {
        const evidence: Array<Evidence> = change.evidence.map((one) => ({
            kind: "decision",
            ref: one.ref,
            label: one.by.name,
            quote: one.quote.slice(0, QUOTE_MAX),
            at: one.at,
        }))
        const { fact } = await this.facts.propose(change.workspaceId, {
            subjectLabel: change.factKey.subjectLabel,
            attributeLabel: change.factKey.attributeLabel,
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

    async stateOf(workspaceId: string, changeId: string): Promise<LearningChangeState> {
        const fact = await this.facts.get(workspaceId, changeId)
        if (fact === null) return "gone"
        if (fact.status === "proposed") return "open"
        return APPLIED.includes(fact.status) ? "applied" : "rejected"
    }
}
