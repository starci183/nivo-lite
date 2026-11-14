import { Injectable } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { BrainFactsService } from "./brain-facts.service"
import type {
    ChangeFiled,
    ChangeRequest,
    Evidence,
    FactInput,
    FactRecord,
    FactSource,
    InstallationScope,
    MaybeFact,
} from "./brain-facts.contracts"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { normalFact, unitOrNull, valueLineOf } from "./fact-input.policy"
import { foldedText, sameValue } from "./fact-key.policy"

/** The subject and attribute of a truth as people write them. */
type FactLabels = Pick<FactInput, "subjectLabel" | "attributeLabel">

/**
 * Who said the words of a change request, as the ENGINE read it (owner order 2026-11-11, item 1): the workspace role of the person who
 * wrote the chat line the request quotes, read by the hook from the line itself, never chosen by the model. A change request is filed
 * under that source: the founder's own words are an owner source (trust 95), a manager's a manager source (85), anyone else's staff (60).
 * It never applies by itself whoever said it (`autoApply: false`): only the founder's yes on the card puts it in force.
 */
export type ChangeSpeaker = Extract<FactSource, "owner" | "manager" | "staff">

/** The source of a request whose speaker the app cannot tell (no team chat hook): relayed words, trust below auto-apply. */
const RELAYED: ChangeSpeaker = "staff"

/** The longest quote a change request keeps. */
const QUOTE_MAX = 500

/** The fewest letters and digits a reason has once folded: "new price" alone is not a reason. */
const REASON_MIN = 12

/**
 * A change request as an agent files it (BG4): the request of W2 with the REASON, why the truth changes in the agent's own plain words
 * (who said what, what it replaces, for how long when said). Optional in the type only so the tool's caller compiles while its schema
 * gains the member; a request without one is refused.
 */
export interface ReasonedChangeRequest extends ChangeRequest {
    /** Why the truth changes, in the agent's own words. */
    readonly reason?: string | undefined
}

/** Why a reason is refused: none (or too short to say anything), or a copy of the value or of the quoted words. */
export type ReasonProblem = "missing" | "copy"

/** A reason as a caller holds it: its text, or none. */
export type ReasonText = string | null | undefined

/** The value a request puts in force, or null for a request to stop using the fact. */
export type RequestedValue = string | null

/** Whether a reason holds: the problem it has, or null when it holds. */
export type ReasonVerdict = ReasonProblem | null

/** Who wrote the quoted line, or nothing when the hook cannot tell. */
export type SpeakerLookup = ChangeSpeaker | undefined

/**
 * Whether a reason says why: refused when empty or shorter than a short sentence, or when it only repeats the new value or the quoted
 * words (accents, case and punctuation ignored). Null when it holds.
 */
export const reasonProblemOf = (
    reason: ReasonText,
    value: RequestedValue,
    quotes: ReadonlyArray<string>,
): ReasonVerdict => {
    const folded = foldedText(reason ?? "")
    if (folded.replaceAll(" ", "").length < REASON_MIN) return "missing"
    const copies = [value ?? "", ...quotes].map((text) => foldedText(text)).filter((text) => text !== "")
    return copies.includes(folded) ? "copy" : null
}

/** The refusal of a request whose reason does not say why. */
const reasonRefusal = (problem: ReasonProblem): BrainFactsError =>
    new BrainFactsError({ code: BrainFactsErrorCode.FactIncomplete, params: { field: "reason", problem } })

/**
 * What else happens around a change request filed from a chat, registered by the app that hosts the team chat (BG4's card service):
 * `vet` checks the words before anything is filed (they must be a person's line in the team chat), `filed` posts or rewrites the card.
 * Without one (an app with no team chat) a request is still filed, with no card.
 */
export interface ChangeRequestHook {
    /**
     * Refuses a request whose words are not a person's line of the workspace's team chat (or not in that line), and answers who wrote
     * the line: the source the request is filed under. Nothing (an older hook) files it as relayed staff words.
     */
    vet(workspaceId: string, request: ReasonedChangeRequest): Promise<SpeakerLookup>
    /** The request was filed (or found waiting, or already true): post or rewrite its card. */
    filed(workspaceId: string, request: ReasonedChangeRequest, filed: ChangeFiled): Promise<void>
    /**
     * The fact in force of ANOTHER key that may say the same thing as a new proposal that replaces nothing by id or key (BG2's
     * near-meaning candidate read), or null. Only a candidate: the proposal is flagged `same_meaning` naming it, and the founder's
     * decision on the card confirms (approve = it replaces that fact) or keeps both; nothing is merged here.
     */
    nearOf?(workspaceId: string, proposal: FactRecord): Promise<MaybeFact>
}

/** The fact of the key a change request is filed under: the subject, attribute and instance scope, as labels. */
interface FiledKey {
    readonly subjectLabel: string
    readonly attributeLabel: string
    readonly subjectKey: string
    readonly attribute: string
    readonly installationId: string | null
}

/** The value of a key that starts first (the one in force has no later rival; of two plans, the next one). */
const earliestOf = (facts: ReadonlyArray<FactRecord>): FactRecord | undefined =>
    [...facts].sort((a, b) => Date.parse(a.validFrom ?? "") - Date.parse(b.validFrom ?? ""))[0]

/**
 * When a change holds (D-BR-6): the window the person said; when they said no start and the value replaced is a PLAN, the plan's own
 * window: a line about a planned truth with no period speaks of that period ("this Valentine adds a 35k surcharge" while 30k is planned from
 * 12/02), so on approval it takes the plan's place (the store keeps one plan per truth: `schedule` drops older plans of the key). A stated
 * start is its own period: approved, it holds from then and the plan still takes over at its start; the card shows both.
 */
const windowOf = (
    request: Pick<ChangeRequest, "validFrom" | "validTo">,
    replaced: FactRecord | undefined,
): Pick<FactInput, "validFrom" | "validTo"> => {
    const said = { validFrom: request.validFrom ?? null, validTo: request.validTo ?? null }
    if (replaced?.status !== "scheduled" || said.validFrom !== null) return said
    return { validFrom: replaced.validFrom, validTo: said.validTo ?? replaced.validTo }
}

/** The refusal of a `replaces` that names no fact in force the caller may read. */
const replacesRefusal = (): BrainFactsError =>
    new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound, params: { field: "replaces" } })

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
    private hook: ChangeRequestHook | null = null

    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly facts: BrainFactsService,
    ) {}

    /** Registers what happens around a filed request (one hook per app: the team chat's card). */
    whenFiled(hook: ChangeRequestHook): void {
        this.hook = hook
    }

    /** Refuses a reason that does not say why (empty, too short, or a copy of the value or of the quoted words). */
    checkReason(reason: ReasonText, value: RequestedValue, quotes: ReadonlyArray<string>): void {
        const problem = reasonProblemOf(reason, value, quotes)
        if (problem !== null) throw reasonRefusal(problem)
    }

    /**
     * Files one change request; answers the waiting proposal, or the fact in force when it already says so. The reason is mandatory;
     * the hook vets the words before filing and posts the card after (the same request again rewrites the same card).
     */
    async propose(workspaceId: string, request: ReasonedChangeRequest): Promise<ChangeFiled> {
        const filed = await this.filed(workspaceId, request)
        await this.hook?.filed(workspaceId, request, filed)
        return filed
    }

    private async filed(workspaceId: string, request: ReasonedChangeRequest): Promise<ChangeFiled> {
        const normal = normalFact({
            subjectLabel: request.subjectLabel,
            attributeLabel: request.attributeLabel,
            value: request.value ?? "-",
        })
        if (normal === null || request.quote.trim() === "") {
            throw new BrainFactsError({ code: BrainFactsErrorCode.FactIncomplete })
        }
        this.checkReason(request.reason, request.value, [request.quote])
        // The source is who wrote the quoted line, read by the engine: the model names a message, never a role.
        const speaker = (await this.hook?.vet(workspaceId, request)) ?? RELAYED
        const evidence = changeEvidenceOf(request, this.clock.now().toISOString())
        // Values whose start has come take over first, so "the value in force" below is the one in force now.
        await this.facts.maintain(workspaceId)
        const active = await this.replacedOf(workspaceId, request, normal)
        if (request.value === null) return this.retire(workspaceId, active, evidence, request, speaker)
        // The value with its unit, in the store's one normal form (the unit the agent gave, else the fact in force's): a value that
        // already names its unit is the same line as the stored one and is stored once, with no unit apart (D-T5-1).
        const line = valueLineOf({ value: normal.value, unit: unitOrNull(request.unit) ?? active?.unit ?? null })
        if (active !== undefined && sameValue(valueLineOf(active), line))
            return { outcome: "already_true", fact: active }
        // A change of a fact in force is filed as the next version of THAT fact: its key and instance scope, not the labels the model chose.
        // A NEW truth is the whole shop's (owner, 2026-11-11: "the whole shop"): filed workspace-wide, whichever agent relays it; what each agent
        // reads of it is its lens (audience, scope and modules), never where it is written (FX6).
        const key: FiledKey = active ?? { ...normal, installationId: null }
        const waiting = await this.waitingValue(workspaceId, key, line)
        const { fact } = await this.facts.propose(workspaceId, {
            subjectLabel: key.subjectLabel,
            attributeLabel: key.attributeLabel,
            value: request.value,
            unit: request.unit ?? null,
            sourceKind: speaker,
            ...windowOf(request, active),
            // The next version of a truth keeps who may read it, also when its only value is a plan (the store reads the scope of an
            // active value alone: D-BR-6 filed a public plan's change as internal).
            ...(active === undefined ? {} : { scope: active.scope, modules: [...active.modules] }),
            evidence: [evidence],
            proposedBy: request.proposedBy,
            installationId: key.installationId,
            // Never the direct path: a chat is an inflow, the founder decides.
            autoApply: false,
        })
        const filed = active === undefined && waiting === undefined ? await this.nearFlagged(workspaceId, fact) : fact
        return { outcome: waiting === undefined ? "filed" : "already_filed", fact: filed }
    }

    /**
     * The value of the truth a request replaces: (1) the fact it names by id (`replaces`), which must be in force or planned
     * (`scheduled`) and readable by the caller's instance, else the request is refused; (2) else the value in force of its exact key, in
     * the caller's instance scope and then the workspace-wide one (a value every instance reads is the one a chat about "the" fee
     * changes); (3) else, D-BR-6, the PLANNED value of that key (a truth whose only value starts later), same order: the change is the
     * next version of that truth, never a new truth beside its plan. Undefined for a new truth.
     */
    private async replacedOf(
        workspaceId: string,
        request: Pick<ChangeRequest, "replaces" | "installationId">,
        normal: Pick<FactRecord, "subjectKey" | "attribute">,
    ): Promise<FactRecord | undefined> {
        if (request.replaces !== undefined && request.replaces !== null) {
            const named = await this.facts.get(workspaceId, request.replaces)
            const readable =
                (named?.status === "active" || named?.status === "scheduled") &&
                named.proposalKind === "set" &&
                (named.installationId === null || named.installationId === request.installationId)
            if (!readable) throw replacesRefusal()
            return named
        }
        const inForce = await this.ofKey(workspaceId, normal, "active", request.installationId)
        return inForce ?? this.ofKey(workspaceId, normal, "scheduled", request.installationId)
    }

    /** The value of a key in one status: the caller's instance's own, then the workspace-wide one (the earliest plan for `scheduled`). */
    private async ofKey(
        workspaceId: string,
        normal: Pick<FactRecord, "subjectKey" | "attribute">,
        status: "active" | "scheduled",
        installationId: InstallationScope,
    ): Promise<FactRecord | undefined> {
        const own = earliestOf(
            await this.facts.byKey(workspaceId, normal.subjectKey, normal.attribute, status, installationId),
        )
        if (own !== undefined || installationId === null) return own
        return earliestOf(await this.facts.byKey(workspaceId, normal.subjectKey, normal.attribute, status, null))
    }

    /**
     * The fact in force a truth of these labels would replace for an agent of this instance, by the same rule as a chat request
     * without `replaces`: the exact key in the instance's scope, then workspace-wide. Undefined for a new truth (filed workspace-wide).
     * For the doors that file through the store directly (the learning's), so they too change a fact in ITS scope (FX6).
     */
    replacedFor(workspaceId: string, labels: FactLabels, installationId: InstallationScope): Promise<MaybeFact> {
        const normal = normalFact({ ...labels, value: "-" })
        if (normal === null) return Promise.resolve(null)
        return this.replacedOf(workspaceId, { replaces: null, installationId }, normal).then((fact) => fact ?? null)
    }

    /**
     * A new proposal that replaces nothing by id or key: (3) the hook's near-meaning candidate in force, if any, is named on the
     * proposal (`same_meaning`, `conflictWith`) for the founder to confirm on the card; never merged here.
     */
    private async nearFlagged(workspaceId: string, fact: FactRecord): Promise<FactRecord> {
        if (fact.status !== "proposed" || fact.proposalKind !== "set" || fact.conflictWith !== null) return fact
        const near = (await this.hook?.nearOf?.(workspaceId, fact)) ?? null
        if (near === null || !(await this.facts.flagSameMeaning(workspaceId, fact.id, near.id))) return fact
        return (await this.facts.get(workspaceId, fact.id)) ?? fact
    }

    /** A request to stop using the value in force: one waiting proposal per fact. */
    private async retire(
        workspaceId: string,
        active: FactRecord | undefined,
        evidence: Evidence,
        request: ChangeRequest,
        speaker: ChangeSpeaker,
    ): Promise<ChangeFiled> {
        if (active === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.NotActive })
        const filed = await this.facts.proposeRetire(workspaceId, active, evidence, request.proposedBy, speaker)
        const proposal = (
            await this.facts.byKey(workspaceId, active.subjectKey, active.attribute, "proposed", active.installationId)
        ).find((fact) => fact.proposalKind === "retire")
        if (proposal === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        return { outcome: filed ? "filed" : "already_filed", fact: proposal }
    }

    /** The proposal of the same value already waiting for the key, if any. */
    private async waitingValue(workspaceId: string, key: FiledKey, line: string): Promise<FactRecord | undefined> {
        const waiting = await this.facts.byKey(
            workspaceId,
            key.subjectKey,
            key.attribute,
            "proposed",
            key.installationId,
        )
        return waiting.find((proposal) => proposal.proposalKind === "set" && sameValue(valueLineOf(proposal), line))
    }
}
