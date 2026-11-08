import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { DOC_ANSWERS, answers, keywordsOf } from "@modules/domain/knowledge-gaps"
import { UsageMeterService } from "@modules/domain/knowledge"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { KNOWLEDGE_BLOCKED_CREDITS, isPublicDraftPayload } from "@modules/queues/knowledge"
import { withoutExcluded } from "./exclusion.policy"
import { PublicDocumentsErrorCode } from "./errors/public-documents.error"
import { InternalReaderService } from "./internal-reader.service"
import { PublicDocumentEntity, PublicDocumentSourceEntity } from "./persistence/entities"
import { PublicDraftWriterService } from "./public-draft-writer.service"
import { MAX_DRAFT_SOURCES, MAX_TITLE_CHARS, type InternalText, type LeftOut } from "./public-documents.contracts"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

/** What the job did with its row. */
export type PublicDraftOutcome = "done" | "skipped"

/** An internal text after the hard exclusions: what may go to the model and what was left out. */
interface Cleaned {
    readonly text: InternalText
    readonly kept: string
    readonly leftOut: ReadonlyArray<LeftOut>
}

const cleaned = (text: InternalText): Cleaned => {
    const split = withoutExcluded(text.text)
    return { text, kept: split.kept, leftOut: split.leftOut }
}

@Injectable()
/**
 * The job behind a public document in the status `drafting`. Either the owner asked NIVO to draft it from chosen internal documents,
 * or a customer asked something the public documents cannot answer and the Brain is searched for an internal answer. No customer is
 * present in either: the internal documents are read through NIVO MCP as an agent the owner granted the tools, the hard exclusions
 * (salary, identity numbers, contracts, capital, internal discounts) are cut out before the model sees the text and again from what
 * it wrote, and the result waits for a person: nothing here publishes.
 */
export class PublicDraftRunService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly reader: InternalReaderService,
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

    /** The owner's draft: each chosen internal document is read, cleaned, and written from. */
    private async draft(row: PublicDocumentEntity): Promise<void> {
        const recorded = await this.entityManager.find(PublicDocumentSourceEntity, {
            where: { documentId: row.id, workspaceId: row.workspaceId },
            take: MAX_DRAFT_SOURCES,
        })
        const reads = await Promise.all(recorded.map((source) => this.reader.read(row.workspaceId, source.sourceId)))
        if (reads.some((read) => read.kind === "no_right"))
            return this.stop(row, PublicDocumentsErrorCode.NoInternalRight)
        const texts = reads.flatMap((read): ReadonlyArray<InternalText> => (read.kind === "ok" ? [read.text] : []))
        if (texts.length !== reads.length) return this.stop(row, PublicDocumentsErrorCode.SourceNotReady)
        const clean = texts.map((text) => cleaned(text))
        const written = await this.write(row, clean, null)
        if (written === null) return undefined
        await this.entityManager.transaction(async (tx) => {
            const changed = await tx.update(
                PublicDocumentEntity,
                { id: row.id, workspaceId: row.workspaceId, status: "drafting", draftRevision: row.draftRevision },
                {
                    body: written.body,
                    leftOut: [...written.leftOut],
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

    /** The proposal for a customer question: the internal documents that cover it are cleaned and written from, or the row goes. */
    private async answer(row: PublicDocumentEntity): Promise<void> {
        const question = row.question ?? row.title
        const found = await this.reader.hits(row.workspaceId, question)
        if (found.kind !== "ok")
            return this.drop(
                row,
                found.kind,
                found.kind === "no_right"
                    ? PublicDocumentsErrorCode.NoInternalRight
                    : PublicDocumentsErrorCode.SourceNotReady,
            )
        const reads = await Promise.all(found.sourceIds.map((id) => this.reader.read(row.workspaceId, id)))
        const words = keywordsOf(question)
        const covering = reads
            .flatMap((read): ReadonlyArray<InternalText> => (read.kind === "ok" ? [read.text] : []))
            .map((text) => cleaned(text))
            .filter((item) => answers(words, new Set(keywordsOf(item.kept)), DOC_ANSWERS))
        if (covering.length === 0) return this.drop(row, "no_answer", PublicDocumentsErrorCode.NothingLeft)
        const written = await this.write(row, covering, question)
        if (written === null) return row.publishedBody === null ? this.drop(row, "no_draft") : undefined
        const committed = await this.entityManager.transaction(async (tx) => {
            const changed = await tx.update(
                PublicDocumentEntity,
                { id: row.id, workspaceId: row.workspaceId, status: "drafting", draftRevision: row.draftRevision },
                {
                    title: question.slice(0, MAX_TITLE_CHARS),
                    body: written.body,
                    leftOut: [...written.leftOut],
                    status: this.settled(row),
                    failureCode: null,
                    draftRevision: row.draftRevision + 1,
                },
            )
            if ((changed.affected ?? 0) !== 1) return false
            await tx.delete(PublicDocumentSourceEntity, { documentId: row.id, workspaceId: row.workspaceId })
            await tx.insert(
                PublicDocumentSourceEntity,
                covering.map((item) => ({
                    documentId: row.id,
                    sourceId: item.text.sourceId,
                    workspaceId: row.workspaceId,
                    sourceTitle: item.text.title,
                    contentHash: item.text.contentHash,
                })),
            )
            return true
        })
        if (committed) this.logger.info(PublicDocumentsLogEvent.ProposalMade, { documentId: row.id })
    }

    /**
     * The model's text for the cleaned sources, cleaned again, with everything left out listed. Null when there is nothing to write
     * from or the model gave nothing; the row is then stopped (an owner's draft) or dropped (a proposal).
     */
    private async write(
        row: PublicDocumentEntity,
        clean: ReadonlyArray<Cleaned>,
        question: string | null,
    ): Promise<{ readonly body: string; readonly leftOut: ReadonlyArray<LeftOut> } | null> {
        const usable = clean.filter((item) => item.kept !== "")
        const leftOut = clean.flatMap((item) => item.leftOut)
        if (usable.length === 0) return this.refuse(row, PublicDocumentsErrorCode.NothingLeft)
        const text = await this.writer.write({
            workspaceId: row.workspaceId,
            title: row.title,
            question,
            instructions: row.instructions,
            sources: usable.map((item) => ({ title: item.text.title, text: item.kept })),
        })
        if (text === null) return this.refuse(row, PublicDocumentsErrorCode.DraftUnavailable)
        const out = withoutExcluded(text.body)
        if (out.kept === "") return this.refuse(row, PublicDocumentsErrorCode.NothingLeft)
        return { body: out.kept, leftOut: [...leftOut, ...out.leftOut] }
    }

    /** Ends a draft that cannot be written; a proposal is dropped instead, since nobody asked for it. */
    private async refuse(row: PublicDocumentEntity, code: PublicDocumentsErrorCode): Promise<null> {
        if (row.gapId === null || row.publishedBody !== null) await this.stop(row, code)
        return null
    }

    /** The row is not wanted: a proposal with no internal answer, no right to look, or no text. */
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
