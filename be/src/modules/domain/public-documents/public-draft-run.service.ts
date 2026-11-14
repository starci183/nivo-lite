import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { KNOWLEDGE_BLOCKED_CREDITS, isPublicDraftPayload } from "@modules/queues/knowledge"
import { shownSourcesOf } from "./draft-sources.policy"
import { PublicDocumentsErrorCode } from "./errors/public-documents.error"
import { InternalReaderService } from "./internal-reader.service"
import { PublicDocumentEntity, PublicDocumentSourceEntity } from "./persistence/entities"
import { PublicDraftWriterService } from "./public-draft-writer.service"
import { MAX_DRAFT_SOURCES, MAX_TITLE_CHARS, type InternalText } from "./public-documents.contracts"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

/** What the job did with its row. */
export type PublicDraftOutcome = "done" | "skipped"

/** What one draft call came to: a text, nothing to write (the documents do not answer), or no readable answer. */
type Composed =
    | { readonly kind: "written"; readonly body: string }
    | { readonly kind: "nothing" }
    | { readonly kind: "unavailable" }

/** The area a draft reads: what customers may read. Any other value, or none, is the internal area. */
const PUBLIC_AREA = "public"

@Injectable()
/**
 * The job behind a public document in the status `drafting`. Either the owner asked NIVO to draft it from chosen documents, or a
 * customer asked something and the Brain is searched for documents that answer it. Drafting is an EXIT of the public area only: a
 * document's AREA is its audience, so only documents of the public area are read and shown to the model; nothing is labelled by a
 * model or a word list. A chosen document that is not in the public area (or whose area cannot be read) is refused before anything
 * is read; among the documents a search finds, only the public ones are read. ONE model call writes the text and says whether the
 * documents answer what is asked; no answer writes nothing. The result waits for a person: nothing here publishes.
 */
export class PublicDraftRunService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly reader: InternalReaderService,
        private readonly sources: KnowledgeSourcesReadService,
        private readonly writer: PublicDraftWriterService,
        private readonly usage: UsageMeterService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes the document the job names; a row that is no longer drafting is left as it is. */
    async generate(payload: object): Promise<PublicDraftOutcome> {
        if (!isPublicDraftPayload(payload)) return "skipped"
        const row = await this.entityManager.findOne(PublicDocumentEntity, {
            where: { id: payload.documentId, workspaceId: payload.workspaceId },
        })
        if (row?.status !== "drafting" || row.draftRevision !== payload.draftRevision) return "skipped"
        if (await this.usage.blockedBy(row.workspaceId, "brain", false)) {
            await this.stop(row, KNOWLEDGE_BLOCKED_CREDITS)
            return "done"
        }
        if (row.gapId === null) await this.draft(row)
        else await this.answer(row)
        return "done"
    }

    /** The job ended as failed after its retries: the document says so, and the owner can ask again. */
    async fail(payload: object): Promise<void> {
        if (!isPublicDraftPayload(payload)) return
        const row = await this.entityManager.findOne(PublicDocumentEntity, {
            where: {
                id: payload.documentId,
                workspaceId: payload.workspaceId,
                status: "drafting",
                draftRevision: payload.draftRevision,
            },
        })
        if (row === null) return
        if (row.gapId === null) await this.stop(row, PublicDocumentsErrorCode.DraftUnavailable)
        else await this.drop(row, "job_failed")
    }

    /**
     * The owner's draft: the area of each chosen document is read first, and one that is not in the public area stops the draft
     * (`SourceInternal`) before any text is read or sent; then each is read (a gone or unready one stops it: `SourceNotReady`) and
     * written from.
     */
    private async draft(row: PublicDocumentEntity): Promise<void> {
        const recorded = await this.entityManager.find(PublicDocumentSourceEntity, {
            where: { documentId: row.id, workspaceId: row.workspaceId },
            take: MAX_DRAFT_SOURCES,
        })
        const ids = recorded.map((source) => source.sourceId)
        const states = await this.sources.statesOf(row.workspaceId, ids)
        // The area is the audience: a source whose area is not exactly the public one (internal, or unreadable) stops the draft.
        if (states.some((state) => state.visibility !== PUBLIC_AREA))
            return this.stop(row, PublicDocumentsErrorCode.SourceInternal)
        const texts = await this.publicTexts(row.workspaceId, ids)
        if (texts.length !== ids.length) return this.stop(row, PublicDocumentsErrorCode.SourceNotReady)
        const written = await this.compose(row, texts, null)
        if (written.kind === "nothing") return this.stop(row, PublicDocumentsErrorCode.NothingLeft)
        if (written.kind === "unavailable") return this.stop(row, PublicDocumentsErrorCode.DraftUnavailable)
        await this.entityManager.transaction(async (tx) => {
            const changed = await tx.update(
                PublicDocumentEntity,
                { id: row.id, workspaceId: row.workspaceId, status: "drafting", draftRevision: row.draftRevision },
                {
                    body: written.body,
                    leftOut: [],
                    status: this.settled(row),
                    failureCode: null,
                    draftRevision: row.draftRevision + 1,
                },
            )
            if ((changed.affected ?? 0) !== 1) return
            await Promise.all(
                texts.map((text) =>
                    tx.update(
                        PublicDocumentSourceEntity,
                        { documentId: row.id, sourceId: text.sourceId },
                        { sourceTitle: text.title, contentHash: text.contentHash },
                    ),
                ),
            )
        })
        return undefined
    }

    /**
     * The proposal for a customer question: of the documents the Brain finds, only those of the public area are read and shown to the
     * same one call with the question. None of them, or a model that says they do not answer it (`answers: false` or an empty body),
     * and the row goes (`no_answer`). No word of the question is compared with a word of a document here.
     */
    private async answer(row: PublicDocumentEntity): Promise<void> {
        const question = row.question ?? row.title
        const found = await this.reader.hits(row.workspaceId, question)
        // A refused search (the reader logged its typed code) is the Brain not answering, not a document that is not ready.
        if (found.kind !== "ok")
            return this.drop(
                row,
                found.kind,
                found.kind === "no_right"
                    ? PublicDocumentsErrorCode.NoInternalRight
                    : PublicDocumentsErrorCode.DraftUnavailable,
            )
        const states = await this.sources.statesOf(row.workspaceId, found.sourceIds)
        const publicIds = found.sourceIds.filter((id) =>
            states.some((state) => state.id === id && state.visibility === PUBLIC_AREA),
        )
        const texts = await this.publicTexts(row.workspaceId, publicIds)
        if (texts.length === 0) return this.drop(row, "no_answer", PublicDocumentsErrorCode.NothingLeft)
        const written = await this.compose(row, texts, question)
        if (written.kind === "nothing") return this.drop(row, "no_answer", PublicDocumentsErrorCode.NothingLeft)
        if (written.kind === "unavailable") return this.drop(row, "no_draft")
        const committed = await this.entityManager.transaction(async (tx) => {
            const changed = await tx.update(
                PublicDocumentEntity,
                { id: row.id, workspaceId: row.workspaceId, status: "drafting", draftRevision: row.draftRevision },
                {
                    title: question.slice(0, MAX_TITLE_CHARS),
                    body: written.body,
                    leftOut: [],
                    status: this.settled(row),
                    failureCode: null,
                    draftRevision: row.draftRevision + 1,
                },
            )
            if ((changed.affected ?? 0) !== 1) return false
            await tx.delete(PublicDocumentSourceEntity, { documentId: row.id, workspaceId: row.workspaceId })
            await tx.insert(
                PublicDocumentSourceEntity,
                texts.map((text) => ({
                    documentId: row.id,
                    sourceId: text.sourceId,
                    workspaceId: row.workspaceId,
                    sourceTitle: text.title,
                    contentHash: text.contentHash,
                })),
            )
            return true
        })
        if (committed) this.logger.info(PublicDocumentsLogEvent.ProposalMade, { documentId: row.id })
    }

    /**
     * The texts of these documents that are of the public area and fully read, in the order asked; any other is left out. The area is
     * read again with the text, so a document moved to the internal area in between is never shown.
     */
    private async publicTexts(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<InternalText>> {
        const read = await Promise.all(ids.map((id) => this.sources.textOf(workspaceId, id)))
        return read.flatMap((source): ReadonlyArray<InternalText> =>
            source?.visibility === PUBLIC_AREA && source.status === "ready" && source.contentHash !== null
                ? [{ sourceId: source.id, title: source.title, contentHash: source.contentHash, text: source.content }]
                : [],
        )
    }

    /**
     * The one call for the documents, each within its share of what one call is shown (a cut is logged; the rest of that text is not
     * written from). `nothing` when no text could be shown or the model says the documents do not answer (`answers: false` or an
     * empty body); `unavailable` when the model gave no readable answer within its tries: nothing of the sources is written then.
     */
    private async compose(
        row: PublicDocumentEntity,
        texts: ReadonlyArray<InternalText>,
        question: string | null,
    ): Promise<Composed> {
        const shown = shownSourcesOf(texts)
        for (const source of shown.filter((one) => one.cut))
            this.logger.warn(PublicDocumentsLogEvent.SourceCut, { documentId: row.id, sourceId: source.sourceId })
        if (shown.every((source) => source.text === "")) return { kind: "nothing" }
        const answer = await this.writer.write({
            workspaceId: row.workspaceId,
            title: row.title,
            question,
            instructions: row.instructions,
            sources: shown,
        })
        if (answer === null) return { kind: "unavailable" }
        const body = answer.body.trim()
        return answer.answers && body !== "" ? { kind: "written", body } : { kind: "nothing" }
    }

    /** The row is not wanted: a proposal with no public answer, no right to search, or no text. */
    private async drop(
        row: PublicDocumentEntity,
        reason: string,
        code: PublicDocumentsErrorCode = PublicDocumentsErrorCode.DraftUnavailable,
    ): Promise<void> {
        if (row.publishedBody !== null) return this.stop(row, code)
        const changed = await this.entityManager.delete(PublicDocumentEntity, {
            id: row.id,
            workspaceId: row.workspaceId,
            status: "drafting",
            draftRevision: row.draftRevision,
        })
        if ((changed.affected ?? 0) > 0)
            this.logger.info(PublicDocumentsLogEvent.ProposalSkipped, { documentId: row.id, reason })
    }

    /** Ends the draft with the stored code of why; a document that was published stays published and serves its approved text. */
    private async stop(row: PublicDocumentEntity, code: string): Promise<void> {
        this.logger.warn(PublicDocumentsLogEvent.DraftRefused, { documentId: row.id, code })
        const status = row.publishedBody === null ? "failed" : "published"
        await this.entityManager.update(
            PublicDocumentEntity,
            { id: row.id, workspaceId: row.workspaceId, status: "drafting", draftRevision: row.draftRevision },
            { status, failureCode: code },
        )
    }

    /** The status a written draft ends in: published when a text of it is live, else a draft. */
    private settled(row: PublicDocumentEntity): "draft" | "published" {
        return row.publishedBody === null ? "draft" : "published"
    }
}
