import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { BrainFactsService } from "./brain-facts.service"
import type { ChangeFiled, ChangeRequest, Evidence, FactRecord } from "./brain-facts.contracts"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { normalFact } from "./fact-input.policy"
import { sameValue } from "./fact-key.policy"

/** The source a change request files under: words of the owner or the staff, relayed by an agent (trust below auto-apply). */
const RELAYED = "staff"

/** The longest quote a change request keeps. */
const QUOTE_MAX = 500

/** What a chat change request rests on: the message the words are in, verbatim. */
export const changeEvidenceOf = (request: ChangeRequest, at: string): Evidence => ({
    kind: "message",
    ref: `team-chat:${request.messageId}`,
    label: request.room === "direct" ? "Private chat with an agent" : "Common chat",
    quote: request.quote.trim().slice(0, QUOTE_MAX),
    at,
})

@Injectable()
/**
 * Change requests from a chat (owner, 2026-11-10: "private chat with an agent and the common chat are inflows"): when someone says
 * something there that changes a truth, the agent files a change request. It is an ordinary proposal of the truth graph and it NEVER
 * activates here, whoever said the words: only the founder's decision on the Second Brain page puts it in force (a new version of the
 * fact). A value the fact in force already has is not filed again; the same waiting value only gains the new message as evidence.
 */
export class BrainChangeRequestsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly facts: BrainFactsService,
    ) {}

    /** Files one change request; answers the waiting proposal, or the fact in force when it already says so. */
    async propose(workspaceId: string, request: ChangeRequest): Promise<ChangeFiled> {
        const normal = normalFact({
            subjectLabel: request.subjectLabel,
            attributeLabel: request.attributeLabel,
            value: request.value ?? "-",
        })
        if (normal === null || request.quote.trim() === "") {
            throw new BrainFactsError({ code: BrainFactsErrorCode.FactIncomplete })
        }
        const evidence = changeEvidenceOf(request, this.clock.now().toISOString())
        const [active] = await this.facts.byKey(
            workspaceId,
            normal.subjectKey,
            normal.attribute,
            "active",
            request.installationId,
        )
        if (request.value === null) return this.retire(workspaceId, active, evidence, request)
        if (active !== undefined && sameValue(active.value, normal.value)) return { outcome: "already_true", fact: active }
        const waiting = await this.waitingValue(workspaceId, normal.subjectKey, normal.attribute, request, normal.value)
        const { fact } = await this.facts.propose(workspaceId, {
            subjectLabel: request.subjectLabel,
            attributeLabel: request.attributeLabel,
            value: request.value,
            unit: request.unit ?? null,
            sourceKind: RELAYED,
            validFrom: request.validFrom ?? null,
            validTo: request.validTo ?? null,
            evidence: [evidence],
            proposedBy: request.proposedBy,
            installationId: request.installationId,
            // Never the direct path: a chat is an inflow, the founder decides.
            autoApply: false,
        })
        return { outcome: waiting === undefined ? "filed" : "already_filed", fact }
    }

    /** A request to stop using the value in force: one waiting proposal per fact. */
    private async retire(
        workspaceId: string,
        active: FactRecord | undefined,
        evidence: Evidence,
        request: ChangeRequest,
    ): Promise<ChangeFiled> {
        if (active === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.NotActive })
        const filed = await this.facts.proposeRetire(workspaceId, active, evidence, request.proposedBy, RELAYED)
        const proposal = (
            await this.facts.byKey(workspaceId, active.subjectKey, active.attribute, "proposed", active.installationId)
        ).find((fact) => fact.proposalKind === "retire")
        if (proposal === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        return { outcome: filed ? "filed" : "already_filed", fact: proposal }
    }

    /** The proposal of the same value already waiting for the key, if any. */
    private async waitingValue(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        request: ChangeRequest,
        value: string,
    ): Promise<FactRecord | undefined> {
        const waiting = await this.facts.byKey(workspaceId, subjectKey, attribute, "proposed", request.installationId)
        return waiting.find((proposal) => proposal.proposalKind === "set" && sameValue(proposal.value, value))
    }
}
