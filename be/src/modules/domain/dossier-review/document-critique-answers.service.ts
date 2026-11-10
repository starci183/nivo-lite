import { Injectable } from "@nestjs/common"
import { BrainFactsReadService, BrainFactsService, type FactRecord } from "@modules/domain/brain-facts"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
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

/** The fact ids a point names: its own and the one it is compared with. */
const namedFacts = (point: CritiquePointView): ReadonlyArray<string> => [
    ...point.factIds,
    ...(point.against?.factId === null || point.against === undefined || point.against === null ? [] : [point.against.factId]),
]

@Injectable()
/**
 * The founder's answers to the document critique. An answer NEVER puts a truth in force: a chosen or typed value is filed as a WAITING
 * proposal (owner source, no auto-apply) and competing proposals are turned down, through the brain-facts decisions behind W2's
 * founder-only door (only the workspace owner answers here); the truth itself is applied later on the graph or the chat card.
 */
export class DocumentCritiqueAnswersService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly critique: DocumentCritiqueReadService,
        private readonly runs: DossierReviewRunsService,
        private readonly facts: BrainFactsService,
        private readonly reads: BrainFactsReadService,
    ) {}

    /** The critique of a document (founder and managers). */
    async view(userId: string, workspaceId: string, sourceId: string, states?: ReadonlyArray<PointState>): Promise<CritiqueView> {
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
        const answer = this.chosen(point, input)
        const proposalFactId = await this.carryOut(me.displayName, input.workspaceId, point, answer)
        await this.critique.recordAnswer(input.workspaceId, input.findingId, { answer, proposalFactId, by: userId, note: input.note ?? null })
        return this.current(input.workspaceId, input.findingId)
    }

    /** Skips a point (founder and managers): it leaves the list and holds no passage back any more. */
    async skip(userId: string, workspaceId: string, findingId: string, reason: string | undefined): Promise<CritiquePointView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.openPoint(workspaceId, findingId)
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
            if (choice.needsInput && typed === "") throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
            return { ...choice.answer, value: choice.needsInput ? typed : choice.answer.value }
        }
        const given = input.answer
        const typed: CriticAnswer | undefined =
            given === undefined
                ? undefined
                : { kind: given.kind, factId: given.factId ?? null, value: given.value ?? null, situation: given.situation ?? null }
        const named = new Set(namedFacts(point))
        const invalid =
            typed === undefined ||
            (typed.factId !== null && !named.has(typed.factId)) ||
            (typed.kind === "value" && (typed.value ?? "").trim() === "") ||
            (typed.kind === "split" && (typed.situation ?? "").trim() === "")
        if (invalid) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
        return typed
    }

    /** Turns an answer into waiting proposals and rejections; answers the proposal the point became. */
    private async carryOut(by: string, workspaceId: string, point: CritiquePointView, answer: CriticAnswer): Promise<string | null> {
        const involved = await this.reads.byIds(workspaceId, namedFacts(point))
        const note = this.say("answer.reject_note", { line: point.line }).slice(0, 500)
        const reject = async (facts: ReadonlyArray<FactRecord>): Promise<void> => {
            for (const fact of facts.filter((one) => one.status === "proposed")) {
                // One decision at a time: each reject re-reads the key it touches.
                // eslint-disable-next-line no-await-in-loop
                await this.facts.reject(workspaceId, fact.id, by, note)
            }
        }
        const picked = involved.find((fact) => fact.id === answer.factId)
        switch (answer.kind) {
            case "pick":
                await reject(involved.filter((fact) => fact.id !== answer.factId && (picked === undefined || this.sameKey(fact, picked))))
                return answer.factId
            case "keep_document":
                return answer.factId
            case "keep_shop":
                await reject(involved.filter((fact) => point.factIds.includes(fact.id) && fact.id !== answer.factId))
                return null
            case "split":
                if (answer.factId === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
                await this.facts.split(workspaceId, answer.factId, answer.situation ?? "", by)
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
        const target = own === undefined ? point.target : { subjectLabel: own.subjectLabel, attributeLabel: own.attributeLabel }
        if (target === null) throw new DossierReviewError({ code: DossierReviewErrorCode.CriticAnswerInvalid })
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
