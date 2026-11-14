import { Injectable } from "@nestjs/common"
import { BrainFactsReadService, BrainFactsService, type FactRecord, valueLineOf, valueTypeProblemOf } from "@modules/domain/brain-facts"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { CritiqueDecisionsService } from "./critique-decisions.service"
import type { CriticAnswer, PointState } from "./document-critic.contracts"
import {
    DocumentCritiqueReadService,
    type CritiquePointView,
    type CritiqueReviewView,
    type CritiqueServingView,
    type CritiqueSourceView,
    type CritiqueView,
} from "./document-critique-read.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"

/** Who may answer a point or let customers read an unreviewed version: the founder (W2's founder rule). */
const FOUNDER: ReadonlyArray<WorkspaceRole> = ["owner"]
/** Who may read the critique, skip a point or ask for the critique again. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** A typed answer as a door hands it over: the fields it leaves out are null. */
export interface TypedAnswer {
    /** What the answer does. */
    readonly kind: CriticAnswer["kind"]
    /** The fact it is about. */
    readonly factId?: string | null | undefined
    /** The value it names. */
    readonly value?: string | null | undefined
    /** The condition of a split. */
    readonly situation?: string | null | undefined
}

/** What the founder answers on a point: one of its choices (with the typed value when it needs one), or a typed answer. */
export interface CritiqueAnswerInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The point. */
    readonly findingId: string
    /** One of its choices. */
    readonly choiceId?: "a" | "b" | undefined
    /** The typed value of a choice that needs one. */
    readonly value?: string | undefined
    /** A typed answer instead of a choice; absent fields are null. */
    readonly answer?: TypedAnswer | undefined
    /** A note kept on the point. */
    readonly note?: string | undefined
}

/** The kind of point only the workspace owner may decide: a line of the document that speaks to the AI (an injection). */
const OWNER_ONLY_KIND = "addressed_to_ai"

/** The fact ids a point names: its own and the one it is compared with. */
const namedFacts = (point: CritiquePointView): ReadonlyArray<string> => [
    ...point.factIds,
    ...(point.against?.factId === null || point.against?.factId === undefined ? [] : [point.against.factId]),
]

@Injectable()
/**
 * The founder's answers to the document critique (only the workspace owner answers here, W2's founder rule). A chosen or typed VALUE is
 * filed as a WAITING proposal (owner source, no auto-apply) and competing proposals are turned down; the answer is then the decision:
 * the settle of the document that follows every answer puts that value in force as decided by the founder (the kept truth as an
 * owner-confirmed version, the typed value as his correction), and nothing else. A point about text addressed to an AI has no
 * buttons: the founder answers it with a typed `keep_document` (it is the business's own text) or `remove` (its truth is turned
 * down), and either closes it, which frees its passage for customers. A SPLIT is the founder's own decision to keep both values, and the founder's decision is the approval: the
 * situational value is put in force at once (`BrainFactsService.split` with `inForce`), exactly as the split on the Second Brain page.
 */
export class DocumentCritiqueAnswersService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly critique: DocumentCritiqueReadService,
        private readonly runs: DossierReviewRunsService,
        private readonly facts: BrainFactsService,
        private readonly reads: BrainFactsReadService,
        private readonly decisions: CritiqueDecisionsService,
    ) {}

    /** The critique of a document (founder and managers). */
    async view(
        userId: string,
        workspaceId: string,
        sourceId: string,
        states?: ReadonlyArray<PointState>,
    ): Promise<CritiqueView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const view = await this.critique.view(workspaceId, sourceId, states ?? ["open"])
        if (view === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound })
        return view
    }

    /** The critiqued documents (founder and managers). */
    async sources(userId: string, workspaceId: string): Promise<ReadonlyArray<CritiqueSourceView>> {
        await this.members.require(userId, workspaceId, MANAGERS)
        return this.critique.sourcesOf(workspaceId)
    }

    /** Answers a point (founder only); answers the point as it now stands. */
    async answer(userId: string, input: CritiqueAnswerInput): Promise<CritiquePointView> {
        const me = await this.members.require(userId, input.workspaceId, FOUNDER)
        const point = await this.openPoint(input.workspaceId, input.findingId)
        const named = await this.reads.byIds(input.workspaceId, namedFacts(point))
        const answer = this.aboutItsTruth(input, point, this.chosen(point, input), named)
        const proposalFactId = await this.carryOut(me.displayName, input.workspaceId, point, answer)
        // Recording the answer sets the customer gate again and has the document's waiting truths settled: the answer decides only the
        // truths it names (kept as written, corrected to the typed value, or dropped); the others follow their own passages.
        await this.critique.recordAnswer(input.workspaceId, input.findingId, {
            answer,
            proposalFactId,
            by: userId,
            // An answer decides only when it keeps who answered: a member with no display name answers under the account id.
            byName: me.displayName.trim() === "" ? userId : me.displayName,
            note: input.note ?? null,
        })
        await this.followed(
            input.workspaceId,
            named.filter((fact) => fact.status === "proposed").map((fact) => fact.id),
        )
        return this.current(input.workspaceId, input.findingId)
    }

    /**
     * Skips a point (founder and managers): it leaves the list and holds no passage back any more. A line that speaks to the AI
     * (`addressed_to_ai`) is the owner's alone to let pass: a manager gets the role refusal (its line stays cut from every agent
     * whatever is decided).
     */
    async skip(
        userId: string,
        workspaceId: string,
        findingId: string,
        reason?: string,
    ): Promise<CritiquePointView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const point = await this.openPoint(workspaceId, findingId)
        if (point.kind === OWNER_ONLY_KIND) await this.members.require(userId, workspaceId, FOUNDER)
        const why = reason?.trim() ?? ""
        await this.critique.skip(workspaceId, findingId, userId, why === "" ? this.say("answer.skip") : why)
        return this.current(workspaceId, findingId)
    }

    /** Asks for the critique of a document again (founder and managers): a review run with the critic, which may call the model; a silent run of 15 minutes is taken back. */
    async retry(userId: string, workspaceId: string, sourceId: string): Promise<CritiqueReviewView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        // A running critique is not interrupted: the request marks the version, and it waits again when the run ends.
        await this.runs.requestForSource(workspaceId, sourceId)
        return this.critique.reviewOfSource(workspaceId, sourceId)
    }

    /** Lets customers read this version of a document although its critique could not finish (founder only). */
    async release(userId: string, workspaceId: string, sourceId: string): Promise<CritiqueServingView> {
        await this.members.require(userId, workspaceId, FOUNDER)
        const serving = await this.critique.release(workspaceId, sourceId, userId)
        if (serving === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound })
        return serving
    }

    private say(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(`critic.${key}`, params, "vi")
    }

    private async openPoint(workspaceId: string, findingId: string): Promise<CritiquePointView> {
        const found = await this.critique.point(workspaceId, findingId)
        if (found === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound })
        if (found.view.state !== "open") throw new DossierReviewError({ code: DossierReviewErrorCode.CriticDecided })
        return found.view
    }

    private async current(workspaceId: string, findingId: string): Promise<CritiquePointView> {
        const found = await this.critique.point(workspaceId, findingId)
        if (found === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound })
        return found.view
    }

    /** The answer the input names: a choice of the point (its typed value filled in) or a typed answer about the point's own facts. */
    private chosen(point: CritiquePointView, input: CritiqueAnswerInput): CriticAnswer {
        if (input.choiceId !== undefined) {
            const choice = point.choices.find((one) => one.id === input.choiceId)
            if (choice === undefined) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
            const typed = input.value?.trim() ?? ""
            if (choice.needsInput && typed === "")
                throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
            return { ...choice.answer, value: choice.needsInput ? typed : choice.answer.value }
        }
        const given = input.answer
        const typed: CriticAnswer | undefined =
            given === undefined
                ? undefined
                : {
                      kind: given.kind,
                      factId: given.factId ?? null,
                      value: given.value ?? null,
                      situation: given.situation ?? null,
                  }
        const named = new Set(namedFacts(point))
        const invalid =
            typed === undefined ||
            (typed.factId !== null && !named.has(typed.factId)) ||
            (typed.kind === "value" && (typed.value ?? "").trim() === "") ||
            (typed.kind === "split" && (typed.situation ?? "").trim() === "")
        if (invalid) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
        return typed
    }

    /**
     * A TYPED "keep the document" or "remove" that names no truth, on a point that is about exactly ONE waiting truth of its
     * document, is an answer about that truth: it is named, so the answer reaches a final state (in force as the founder kept it,
     * or withdrawn) instead of closing the point and leaving the truth waiting. By ids and states only. A point about several
     * truths, and a choice of the point (which binds to what the critic built, or on purpose to nothing), stay as given.
     */
    private aboutItsTruth(
        input: CritiqueAnswerInput,
        point: CritiquePointView,
        answer: CriticAnswer,
        named: ReadonlyArray<FactRecord>,
    ): CriticAnswer {
        const unbound = input.choiceId === undefined && answer.factId === null && (answer.kind === "keep_document" || answer.kind === "remove")
        if (!unbound) return answer
        const own = named.filter(
            (fact) => point.factIds.includes(fact.id) && fact.status === "proposed" && fact.id !== point.against?.factId,
        )
        const [only] = own
        return own.length === 1 && only !== undefined ? { ...answer, factId: only.id } : answer
    }

    /**
     * What an answer leaves behind, so that it ends somewhere: the truths it turned down close the OTHER open points that asked about
     * them and about nothing that still waits (the twin point of the same truth, the point that held it against the value in force).
     * Nothing is asked again: no truth waits for a review or a verdict.
     */
    private async followed(workspaceId: string, waited: ReadonlyArray<string>): Promise<void> {
        const now = waited.length === 0 ? [] : await this.reads.byIds(workspaceId, [...waited])
        await this.decisions.turnedDown(
            workspaceId,
            now.filter((fact) => fact.status === "rejected").map((fact) => fact.id),
        )
    }

    /**
     * A typed value that does not read as the type of the value in force for the truth it corrects ("soon" on a price) is refused
     * at the door: filed, it would wait for ever with no point left to ask about it. The store's own rule (`valueTypeProblemOf`).
     */
    private async ofItsType(workspaceId: string, own: FactRecord | undefined, value: string): Promise<void> {
        if (own === undefined) return
        const [current] = await this.reads.byKey(workspaceId, own.subjectKey, own.attribute, "active", own.installationId)
        if (current === undefined) return
        const labels = `${own.subjectLabel} ${own.attributeLabel}`
        if (valueTypeProblemOf({ value: valueLineOf(current), labels }, { value, labels }) !== null)
            throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
    }

    /** Turns an answer into waiting proposals and rejections; answers the proposal the point became. */
    private async carryOut(
        by: string,
        workspaceId: string,
        point: CritiquePointView,
        answer: CriticAnswer,
    ): Promise<string | null> {
        const involved = await this.reads.byIds(workspaceId, namedFacts(point))
        const note = this.say("answer.reject_note", { line: point.line }).slice(0, 500)
        // One decision at a time: each reject re-reads the key it touches.
        const reject = (facts: ReadonlyArray<FactRecord>): Promise<void> =>
            eachInOrder(
                facts.filter((one) => one.status === "proposed"),
                (fact) => this.facts.reject(workspaceId, fact.id, by, note),
            )
        const picked = involved.find((fact) => fact.id === answer.factId)
        switch (answer.kind) {
            case "pick":
                // The other values of the picked truth's key, and the truth the point set it against (a link of the same-fact judge
                // names the same thing under ANOTHER key): both cannot stay.
                await reject(
                    involved.filter(
                        (fact) =>
                            fact.id !== answer.factId &&
                            (picked === undefined || this.sameKey(fact, picked) || fact.id === point.against?.factId),
                    ),
                )
                return answer.factId
            case "keep_document":
                return answer.factId
            case "keep_shop":
                await reject(involved.filter((fact) => point.factIds.includes(fact.id) && fact.id !== answer.factId))
                return null
            case "split":
                if (answer.factId === null)
                    throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
                // The founder's split is the approval (this door is founder-only): in force at once.
                await this.facts.split(workspaceId, answer.factId, answer.situation ?? "", by, true)
                return answer.factId
            case "remove":
                await reject(picked === undefined ? [] : [picked])
                return null
            case "value":
                return this.filed(by, workspaceId, point, answer, involved, reject)
        }
    }

    private sameKey(fact: FactRecord, picked: FactRecord): boolean {
        return fact.subjectKey === picked.subjectKey && fact.attribute === picked.attribute
    }

    /** Files a typed value as a NEW waiting proposal on the thing the point is about, and turns the document's competing proposal down. */
    private async filed(
        by: string,
        workspaceId: string,
        point: CritiquePointView,
        answer: CriticAnswer,
        involved: ReadonlyArray<FactRecord>,
        reject: (facts: ReadonlyArray<FactRecord>) => Promise<void>,
    ): Promise<string> {
        const own =
            involved.find((fact) => fact.id === answer.factId) ??
            involved.find((fact) => point.factIds.includes(fact.id) && fact.id !== point.against?.factId)
        const target =
            own === undefined ? point.target : { subjectLabel: own.subjectLabel, attributeLabel: own.attributeLabel }
        if (target === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
        await this.ofItsType(workspaceId, own, answer.value ?? "")
        const result = await this.facts.propose(workspaceId, {
            subjectLabel: target.subjectLabel,
            attributeLabel: target.attributeLabel,
            value: answer.value ?? "",
            scope: own?.scope,
            installationId: own?.installationId ?? null,
            sourceKind: "owner",
            proposedBy: by,
            autoApply: false,
            evidence: [
                {
                    kind: "manual",
                    ref: `critic:${point.id}`,
                    label: this.say("answer.evidence", { by }),
                    quote: point.question === "" ? undefined : point.question.slice(0, 200),
                },
            ],
        })
        if (own !== undefined && own.id !== result.fact.id) await reject([own])
        return result.fact.id
    }
}
