import { Injectable } from "@nestjs/common"
import { In, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { BrainFactsReadService, factLine, factSlugOf } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { DossierSourcesService, KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { isDossierRemedyPayload, KNOWLEDGE_BLOCKED_CREDITS, KnowledgeQueue } from "@modules/queues/knowledge"
import { packEntryOf } from "./dossier-pack.policy"
import { InjectRemedyWriter } from "./dossier-review.decorators"
import { DOSSIER_REVIEW_CAPS, JOB_FAILED } from "./dossier-review.contracts"
import type {
    DraftStatus,
    JobOutcome,
    MaybeRemedyDraft,
    OptionalText,
    RemedyDraftRecord,
} from "./dossier-review.contracts"
import type { RemedyWriter } from "./dossier-review.port"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"
import { toDraftRecord } from "./finding-record.mapper"
import { DossierFindingEntity, DossierRemedyDraftEntity } from "./persistence/entities"
import { ReviewInputsService } from "./review-inputs.service"
import { displayDate } from "./rule-kit.policy"

/** Who may ask for, edit and decide on a draft. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The bounds of the text of a draft. */
const DRAFT = { title: 160, documentType: 80, placeholders: 30, label: 120, reason: 200, instructions: 1_000 } as const

/** The bound of a rejection reason. */
const REASON_MAX = 500

/** The attribute slugs of the identity facts a draft is written from: name, tax code, address, members and shares, the legal representative and the council chair. */
const IDENTITY_ATTRIBUTES: ReadonlySet<string> = new Set(
    [
        "ten cong ty",
        "ten doanh nghiep",
        "ma so thue",
        "dia chi",
        "dia chi tru so",
        "von dieu le",
        "ty le von gop",
        "phan von gop",
        "nguoi dai dien theo phap luat",
        "chu tich hoi dong thanh vien",
    ].map(factSlugOf),
)

/** The most identity lines a draft is written from. */
const IDENTITY_MAX = 40

const LIVE: ReadonlyArray<DraftStatus> = ["generating", "proposed"]

const clip = (text: string, max: number): string => text.slice(0, max)

/** The reference as a document title prefix: two digits for a number ("02. ..."), as is otherwise. */
const prefixOf = (ref: string): string => (/^\d$/u.test(ref) ? `0${ref}` : ref)

/** The tag that marks the source an approved draft became; hyphens dropped so it fits the forty characters of a tag. */
export const remedyTagOf = (draftId: string): string => `remedy:${draftId.replaceAll("-", "")}`

@Injectable()
/** The drafts NIVO writes for a finding: asked for by an owner or a manager, written by a job, edited, then approved into the dossier or rejected. */
export class DossierRemedyDraftsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectRemedyWriter() private readonly writer: RemedyWriter,
        private readonly members: WorkspaceMembersService,
        private readonly inputs: ReviewInputsService,
        private readonly facts: BrainFactsReadService,
        private readonly usage: UsageMeterService,
        private readonly sources: KnowledgeSourcesService,
        private readonly dossierSources: DossierSourcesService,
        private readonly queue: KnowledgeQueue,
    ) {}

    /** Asks NIVO to draft the remedy of an active finding NIVO can draft; a live draft of it is answered as it is. */
    async request(
        userId: string,
        workspaceId: string,
        findingId: string,
        instructions: OptionalText,
    ): Promise<RemedyDraftRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const finding = await this.entityManager.findOne(DossierFindingEntity, {
            where: { id: findingId, workspaceId },
        })
        if (finding === null) throw new DossierReviewError({ code: DossierReviewErrorCode.FindingNotFound })
        if (finding.remedyAction !== "draft" || (finding.status !== "open" && finding.status !== "confirmed")) {
            throw new DossierReviewError({ code: DossierReviewErrorCode.TransitionRefused })
        }
        const live = await this.entityManager.findOne(DossierRemedyDraftEntity, {
            where: { workspaceId, findingId, status: In([...LIVE]) },
        })
        if (live !== null) return toDraftRecord(live)
        const since = new Date(this.clock.now().getTime() - DOSSIER_REVIEW_CAPS.dayMs)
        const today = await this.entityManager.count(DossierRemedyDraftEntity, {
            where: { workspaceId, createdAt: MoreThanOrEqual(since) },
        })
        if (today >= DOSSIER_REVIEW_CAPS.dailyRemedyDrafts) {
            throw new DossierReviewError({ code: DossierReviewErrorCode.DraftDailyLimit })
        }
        const memberId = await this.members.idOf(userId, workspaceId)
        const note = (instructions ?? "").trim()
        const draft = await this.entityManager.transaction(async (tx) => {
            const saved = await tx.save(DossierRemedyDraftEntity, {
                workspaceId,
                findingId,
                dossierId: finding.dossierId,
                status: "generating",
                instructions: note === "" ? null : clip(note, DRAFT.instructions),
                requestedBy: memberId,
            })
            await this.queue.enqueueDossierRemedy({ draftId: saved.id, workspaceId }, tx)
            return saved
        })
        return toDraftRecord(draft)
    }

    /** Writes a generating draft through the model; without credits, or when the model cannot answer, the draft ends failed. */
    async generate(payload: object): Promise<JobOutcome> {
        if (!isDossierRemedyPayload(payload)) return "skipped"
        const { workspaceId, draftId } = payload
        const draft = await this.entityManager.findOne(DossierRemedyDraftEntity, {
            where: { id: draftId, workspaceId },
        })
        if (draft?.status !== "generating") return "skipped"
        const finding = await this.entityManager.findOne(DossierFindingEntity, {
            where: { id: draft.findingId, workspaceId },
        })
        if (finding === null) return this.failed(draft, DossierReviewErrorCode.FindingNotFound)
        if (await this.usage.blockedBy(workspaceId, "brain", false))
            return this.failed(draft, KNOWLEDGE_BLOCKED_CREDITS)
        const dossier = (await this.inputs.all(workspaceId)).find((item) => item.id === finding.dossierId)
        const entry = dossier === undefined ? null : packEntryOf(dossier)
        const identity = (await this.facts.list(workspaceId, { statuses: ["active", "proposed"], limit: 500 }))
            .filter((fact) => IDENTITY_ATTRIBUTES.has(fact.attribute))
            .slice(0, IDENTITY_MAX)
            .map(factLine)
        const now = this.clock.now()
        const text = await this.writer.draft({
            workspaceId,
            today: now.toISOString().slice(0, 10),
            finding: {
                kind: finding.kind,
                severity: finding.severity,
                title: finding.title,
                detail: finding.detail,
                evidence: finding.evidence.map((item) => ({ label: item.label, quote: item.quote })),
            },
            dossier: {
                ref: dossier?.ref ?? "",
                name: dossier?.name ?? "",
                category: dossier?.category ?? "",
            },
            remedy: {
                documentType: entry?.remedy?.documentType ?? finding.remedyDocumentType,
                guidance: entry?.remedy?.guidance ?? null,
            },
            identity,
            instructions: draft.instructions,
        })
        if (text === null) return this.failed(draft, DossierReviewErrorCode.ModelUnavailable)
        const tail = this.catalog.get(
            "draft.tail",
            { date: displayDate(now.toISOString().slice(0, 10)), title: finding.title },
            "vi",
        )
        await this.entityManager.update(
            DossierRemedyDraftEntity,
            { id: draft.id, workspaceId, status: "generating" },
            {
                status: "proposed",
                title: clip(text.title, DRAFT.title),
                documentType: clip(text.documentType, DRAFT.documentType),
                body: `${clip(text.body, DOSSIER_REVIEW_CAPS.remedyBodyChars)}\n\n${tail}`,
                placeholders: text.placeholders.slice(0, DRAFT.placeholders).map((item) => ({
                    label: clip(item.label, DRAFT.label),
                    reason: clip(item.reason, DRAFT.reason),
                })),
                model: text.model,
                error: null,
            },
        )
        return "done"
    }

    /** The job of a draft failed for good: a generating draft ends failed. */
    async fail(payload: object): Promise<void> {
        if (!isDossierRemedyPayload(payload)) return
        await this.entityManager.update(
            DossierRemedyDraftEntity,
            { id: payload.draftId, workspaceId: payload.workspaceId, status: "generating" },
            { status: "failed", error: JOB_FAILED },
        )
    }

    /** One draft of the workspace for any member, or null. */
    async get(userId: string, workspaceId: string, draftId: string): Promise<MaybeRemedyDraft> {
        await this.members.require(userId, workspaceId)
        const draft = await this.entityManager.findOne(DossierRemedyDraftEntity, {
            where: { id: draftId, workspaceId },
        })
        return draft === null ? null : toDraftRecord(draft)
    }

    /** Saves the owner's edits of a proposed draft. */
    async save(
        userId: string,
        workspaceId: string,
        draftId: string,
        title: string,
        body: string,
    ): Promise<RemedyDraftRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.proposed(workspaceId, draftId)
        return this.change(workspaceId, draftId, {
            title: clip(title.trim(), DRAFT.title),
            body: clip(body, DOSSIER_REVIEW_CAPS.remedyBodyChars),
        })
    }

    /**
     * Files a proposed draft into its dossier as a knowledge source added as the approving user, then resolves its finding. An approved
     * draft answers as it is; a source already tagged with the draft is reused, so a retry adds no second one. A full allowance refuses it
     * with the quota error and the draft stays proposed.
     */
    async approve(userId: string, workspaceId: string, draftId: string): Promise<RemedyDraftRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const current = await this.draftOf(workspaceId, draftId)
        if (current.status === "approved") return toDraftRecord(current)
        const draft = await this.proposed(workspaceId, draftId)
        const dossier = (await this.inputs.all(workspaceId)).find((item) => item.id === draft.dossierId)
        const tag = remedyTagOf(draft.id)
        const existing = await this.dossierSources.byTag(workspaceId, tag)
        const sourceId =
            existing?.id ??
            (
                await this.sources.addSource(userId, workspaceId, {
                    kind: "text",
                    title: dossier === undefined ? draft.title : `${prefixOf(dossier.ref)}. ${draft.title}`,
                    content: draft.body,
                    ...(dossier === undefined ? {} : { topic: dossier.category }),
                    tags: [...(dossier === undefined ? [] : [`dossier:${dossier.ref}`]), "nivo:draft", tag],
                    visibility: "internal",
                    origin: "dossier-review",
                })
            ).id
        const memberId = await this.members.idOf(userId, workspaceId)
        const now = this.clock.now()
        await this.entityManager.transaction(async (tx) => {
            await tx.update(
                DossierRemedyDraftEntity,
                { id: draft.id, workspaceId, status: "proposed" },
                { status: "approved", sourceId, decidedBy: memberId, decidedAt: now },
            )
            await tx.update(
                DossierFindingEntity,
                { id: draft.findingId, workspaceId, status: In(["open", "confirmed"]) },
                { status: "resolved", resolution: "draft", resolvedAt: now, decidedBy: memberId, decidedAt: now },
            )
        })
        return toDraftRecord(await this.draftOf(workspaceId, draftId))
    }

    /** Rejects a proposed draft with an optional reason; its finding stays as it was. */
    async reject(
        userId: string,
        workspaceId: string,
        draftId: string,
        reason: OptionalText,
    ): Promise<RemedyDraftRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.proposed(workspaceId, draftId)
        const memberId = await this.members.idOf(userId, workspaceId)
        const note = (reason ?? "").trim()
        return this.change(workspaceId, draftId, {
            status: "rejected",
            rejectReason: note === "" ? null : clip(note, REASON_MAX),
            decidedBy: memberId,
            decidedAt: this.clock.now(),
        })
    }

    private async draftOf(workspaceId: string, draftId: string): Promise<DossierRemedyDraftEntity> {
        const draft = await this.entityManager.findOne(DossierRemedyDraftEntity, {
            where: { id: draftId, workspaceId },
        })
        if (draft === null) throw new DossierReviewError({ code: DossierReviewErrorCode.DraftNotFound })
        return draft
    }

    private async proposed(workspaceId: string, draftId: string): Promise<DossierRemedyDraftEntity> {
        const draft = await this.draftOf(workspaceId, draftId)
        if (draft.status !== "proposed")
            throw new DossierReviewError({ code: DossierReviewErrorCode.TransitionRefused })
        return draft
    }

    /** Changes a draft while it is still proposed, and answers it. */
    private async change(
        workspaceId: string,
        draftId: string,
        changes: Partial<DossierRemedyDraftEntity>,
    ): Promise<RemedyDraftRecord> {
        const written = await this.entityManager.update(
            DossierRemedyDraftEntity,
            { id: draftId, workspaceId, status: "proposed" },
            changes,
        )
        if (written.affected === 0) throw new DossierReviewError({ code: DossierReviewErrorCode.TransitionRefused })
        return toDraftRecord(await this.draftOf(workspaceId, draftId))
    }

    private async failed(draft: DossierRemedyDraftEntity, error: string): Promise<"done"> {
        await this.entityManager.update(
            DossierRemedyDraftEntity,
            { id: draft.id, workspaceId: draft.workspaceId, status: "generating" },
            { status: "failed", error },
        )
        return "done"
    }
}
