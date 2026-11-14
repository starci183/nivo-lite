import { Injectable } from "@nestjs/common"
import { In, Not, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import {
    PARKED,
    documentTruthsOf,
    natureViewOf,
    type BlockedExtraction,
    type DocumentTruthsView,
    type EndNote,
    type ExtractionProgress,
    type ExtractionProgressView,
    type ExtractionRecord,
    type ExtractionStart,
    type ExtractionState,
    type MaybeExtraction,
    type MaybeInstant,
    type MaybeNatureJson,
    type NatureJson,
    type StoredFormMate,
    type StoredNature,
    type TruthCounts,
    type WindowNote,
} from "./brain-extractions.contracts"
import { BrainExtractionEntity } from "./persistence/entities"

/** The longest raw answer a note keeps, in characters. */
const NOTE_ANSWER_MAX = 1000

/** The reading's notes with the new one appended, the newest 20 kept (`:note` is a JSON array of one note). */
const NOTES_APPENDED =
    "COALESCE((SELECT jsonb_agg(item.value ORDER BY item.place) FROM jsonb_array_elements(answer_notes || CAST(:note AS jsonb)) WITH ORDINALITY AS item(value, place) WHERE item.place > jsonb_array_length(answer_notes || CAST(:note AS jsonb)) - 20), '[]'::jsonb)"

/** The model readings of one FORM in a workspace, other than one document (TRIAGE-6). */
export const FORM_MATES = `SELECT bx.source_id, bx.document_nature, ks.title
FROM public.brain_extractions bx
JOIN public.knowledge_sources ks ON ks.id = bx.source_id
WHERE bx.workspace_id = $1 AND bx.source_id <> $2 AND bx.document_nature ->> 'form' = $3 AND bx.document_nature ->> 'by' = 'model'
ORDER BY ks.created_at
LIMIT 20`

/** The counts of a row. */
const countsOf = (row: BrainExtractionEntity): TruthCounts => ({
    passagesTotal: row.passagesTotal,
    passagesTriaged: row.passagesTriaged,
    passagesKept: row.passagesKept,
    factsApplied: row.factsApplied,
    factsAsked: row.factsAsked,
    factsWaiting: row.factsWaiting,
})

/** An extraction as the callers read it. */
const toRecord = (row: BrainExtractionEntity): ExtractionRecord => ({
    sourceId: row.sourceId,
    status: row.status,
    factsProposed: row.factsProposed,
    promptVersion: row.promptVersion,
    contentHash: row.contentHash,
    windowsTotal: row.windowsTotal,
    windowsDone: row.windowsDone,
    attempts: row.attempts,
    orphanFactIds: row.orphanFactIds,
    passageHashes: row.passageHashes,
    factsChanged: row.factsChanged,
    stage: row.stage,
    counts: countsOf(row),
    windowsSkipped: row.windowsSkipped,
    linesRefused: row.linesRefused,
    linesUnread: row.linesUnread,
    updatedAt: row.updatedAt,
    nature: natureViewOf({ reading: row.documentNature ?? null, override: row.natureOverride ?? null }),
})

@Injectable()
/** Where the reading of each document stands, so a text read with the same prompt is never read twice and a reading can resume. */
export class BrainExtractionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The reading of a document. */
    async get(workspaceId: string, sourceId: string): Promise<MaybeExtraction> {
        const row = await this.entityManager.findOne(BrainExtractionEntity, { where: { workspaceId, sourceId } })
        return row === null ? null : toRecord(row)
    }

    /** Where the reading of every document of the workspace stands. */
    async states(workspaceId: string): Promise<ReadonlyArray<ExtractionState>> {
        const rows = await this.entityManager.find(BrainExtractionEntity, {
            select: { sourceId: true, status: true },
            where: { workspaceId },
            take: 500,
        })
        return rows.map((row) => ({ sourceId: row.sourceId, status: row.status }))
    }

    /** How far the reading of every document of the workspace got, for the truth graph's list of sources. */
    async progress(workspaceId: string): Promise<ReadonlyArray<ExtractionProgressView>> {
        const rows = await this.entityManager.find(BrainExtractionEntity, {
            where: { workspaceId },
            take: 500,
        })
        return rows.map((row) => this.viewOf(row))
    }

    /** How far the truths work of these documents got (the documents list asks for the page it shows), in one read by primary key. */
    async progressOf(workspaceId: string, sourceIds: ReadonlyArray<string>): Promise<ReadonlyArray<ExtractionProgressView>> {
        if (sourceIds.length === 0) return []
        const rows = await this.entityManager.find(BrainExtractionEntity, {
            where: { workspaceId, sourceId: In(sourceIds.slice(0, 500)) },
            take: 500,
        })
        return rows.map((row) => this.viewOf(row))
    }

    /** Where the truths of these documents stand, by document, in the shape the documents page reads; a document with no reading is absent. */
    async truthsOf(workspaceId: string, sourceIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, DocumentTruthsView>> {
        const rows = await this.progressOf(workspaceId, sourceIds)
        return new Map(rows.map((row) => [row.sourceId, documentTruthsOf(row)]))
    }

    /** A row as the lists show it. */
    private viewOf(row: BrainExtractionEntity): ExtractionProgressView {
        return {
            sourceId: row.sourceId,
            status: row.status,
            windowsDone: row.windowsDone,
            windowsTotal: row.windowsTotal,
            factsProposed: row.factsProposed,
            stage: row.stage,
            error: row.error,
            counts: countsOf(row),
            windowsSkipped: row.windowsSkipped,
            linesRefused: row.linesRefused,
            linesUnread: row.linesUnread,
            nature: natureViewOf({ reading: row.documentNature ?? null, override: row.natureOverride ?? null }),
        }
    }

    /**
     * The other documents of the workspace whose model reading has this FORM (TRIAGE-6: like documents judged consistently), at most 20,
     * with their stored reading and title. One read by workspace.
     */
    async formMates(workspaceId: string, sourceId: string, form: string): Promise<ReadonlyArray<StoredFormMate>> {
        const rows: unknown = await this.entityManager.query(FORM_MATES, [workspaceId, sourceId, form])
        return Array.isArray(rows)
            ? rows.flatMap((row: unknown): Array<StoredFormMate> => {
                  if (!isRecord(row)) return []
                  const id = row["source_id"]
                  const reading = row["document_nature"]
                  const title = row["title"]
                  return typeof id === "string" && isRecord(reading)
                      ? [{ sourceId: id, reading: { ...reading }, title: typeof title === "string" ? title : "" }]
                      : []
              })
            : []
    }

    /**
     * Opens these readings again at triage (a like document's judgement changed what they inherit, TRIAGE-6): a reading that ended or
     * waits goes back to running; a running one takes it at its next stage. Answers the ids opened (the caller queues their jobs).
     */
    reopenAtTriage(
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        tx: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<string>> {
        if (sourceIds.length === 0) return Promise.resolve([])
        return this.openAtTriage(tx, workspaceId, sourceIds)
    }

    /** Moves the readings of these documents that ended or wait back to running at triage; answers the ids it moved. */
    private async openAtTriage(
        tx: EntityManager,
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<string>> {
        const opened = await tx
            .createQueryBuilder(BrainExtractionEntity, "bx")
            .update()
            .set({ status: "running", stage: "triage", error: null, attempts: 0 })
            .where({ workspaceId, sourceId: In([...sourceIds]), status: In(["done", "failed", ...PARKED]) })
            .returning(["source_id"])
            .execute()
        const raw: unknown = opened.raw
        const rows: ReadonlyArray<unknown> = Array.isArray(raw) ? raw : []
        return rows.flatMap((row) => {
            const id = isRecord(row) ? row["source_id"] : undefined
            return typeof id === "string" ? [id] : []
        })
    }

    /** The stored judgement of what a document is (the model's reading and the founder's answer); both null when there is no reading row. */
    async natureOf(workspaceId: string, sourceId: string): Promise<StoredNature> {
        const row = await this.entityManager.findOne(BrainExtractionEntity, {
            select: { sourceId: true, documentNature: true, natureOverride: true },
            where: { workspaceId, sourceId },
        })
        return { reading: row?.documentNature ?? null, override: row?.natureOverride ?? null }
    }

    /** Saves the model's reading of what a document is (one per text version; the founder's answer is never touched here). */
    async saveNature(workspaceId: string, sourceId: string, reading: NatureJson): Promise<void> {
        await this.entityManager
            .createQueryBuilder(BrainExtractionEntity, "bx")
            .update()
            .set({ documentNature: () => "CAST(:reading AS jsonb)" })
            .where({ workspaceId, sourceId })
            .setParameters({ reading: JSON.stringify(reading) })
            .execute()
    }

    /**
     * Saves the founder's answer on what a document is (null takes it back) and opens its reading again at triage, so its passages take
     * the new judgement: a reading that ended or waits goes back to running; a running one takes it at its next stage. Answers the ids of
     * the readings this call opened (the caller queues their jobs in the same transaction).
     */
    async overrideNature(
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        override: MaybeNatureJson,
        tx: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<string>> {
        if (sourceIds.length === 0) return []
        await tx
            .createQueryBuilder(BrainExtractionEntity, "bx")
            .update()
            .set({ natureOverride: () => "CAST(:override AS jsonb)" })
            .where({ workspaceId, sourceId: In([...sourceIds]) })
            .setParameters({ override: override === null ? null : JSON.stringify(override) })
            .execute()
        return this.openAtTriage(tx, workspaceId, sourceIds)
    }

    /** Starts the reading of a document from its first window. */
    async start(start: ExtractionStart): Promise<void> {
        await this.entityManager.upsert(
            BrainExtractionEntity,
            {
                sourceId: start.sourceId,
                workspaceId: start.workspaceId,
                status: "running",
                factsProposed: 0,
                error: null,
                model: null,
                promptVersion: start.promptVersion,
                contentHash: start.contentHash,
                windowsTotal: start.windowsTotal,
                windowsDone: 0,
                attempts: 0,
                orphanFactIds: [...start.orphanFactIds],
                factsChanged: start.factsChanged,
                stage: "triage",
                passagesTotal: start.passagesTotal,
                passagesTriaged: 0,
                passagesKept: 0,
                factsApplied: 0,
                factsAsked: 0,
                factsWaiting: 0,
                windowsSkipped: 0,
                linesRefused: 0,
                linesUnread: 0,
                answerNotes: [],
            },
            ["sourceId"],
        )
    }

    /**
     * The readings that wait (for credits, for room under the ceiling, or parked `awaiting_critique` by an earlier build), the
     * longest-waiting first, at most `limit`: one read on `brain_extractions_parked` (migration 20261112015500), for the upkeep tick
     * that lets them go on.
     */
    async parked(limit: number): Promise<ReadonlyArray<BlockedExtraction>> {
        const rows = await this.entityManager.find(BrainExtractionEntity, {
            select: {
                workspaceId: true,
                sourceId: true,
                contentHash: true,
                windowsDone: true,
                windowsTotal: true,
                status: true,
            },
            where: { status: In([...PARKED]) },
            order: { updatedAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            workspaceId: row.workspaceId,
            sourceId: row.sourceId,
            contentHash: row.contentHash,
            windowsDone: row.windowsDone,
            windowsTotal: row.windowsTotal,
            status: row.status,
        }))
    }

    /**
     * Since when the workspace has readings stopped at the ceiling of truths: the time the longest-waiting one stopped, or null when
     * none is. It names the EPISODE of the ceiling: it stays the same while documents keep stopping there, and a new one starts once
     * there was room again (the tick lets every such reading go on).
     */
    async ceilingSince(workspaceId: string): Promise<MaybeInstant> {
        const row = await this.entityManager.findOne(BrainExtractionEntity, {
            select: { sourceId: true, updatedAt: true },
            where: { workspaceId, status: "at_ceiling" },
            order: { updatedAt: "ASC" },
        })
        return row?.updatedAt ?? null
    }

    /** A reading that waited goes on: answers whether THIS call moved it (another tick may have). */
    async resume(workspaceId: string, sourceId: string, tx: EntityManager = this.entityManager): Promise<boolean> {
        const moved = await tx.update(
            BrainExtractionEntity,
            { workspaceId, sourceId, status: In([...PARKED]) },
            { status: "running", error: null },
        )
        return (moved.affected ?? 0) > 0
    }

    /**
     * A reading that ended or waits is opened again at its settle stage (a point of its critique was raised, answered or closed):
     * answers whether this call moved it. A reading that is running is left to its own course.
     */
    async reopen(workspaceId: string, sourceId: string, tx: EntityManager = this.entityManager): Promise<boolean> {
        const moved = await tx.update(
            BrainExtractionEntity,
            { workspaceId, sourceId, status: In(["done", "awaiting_critique", "at_ceiling"]), stage: "settle" },
            { status: "running", error: null },
        )
        return (moved.affected ?? 0) > 0
    }

    /**
     * Whether the reading is in the middle of a settle (running at the settle stage): a change of the critic's verdict that arrives now
     * was not read by that settle, so the caller queues another one (BRAIN-OPS, D-U-3: an answer given during a settle ended nowhere).
     */
    settling(workspaceId: string, sourceId: string, tx: EntityManager = this.entityManager): Promise<boolean> {
        return tx.exists(BrainExtractionEntity, { where: { workspaceId, sourceId, status: "running", stage: "settle" } })
    }

    /** Saves how far the reading got (in the caller's transaction when it gives one). */
    async save(
        workspaceId: string,
        sourceId: string,
        progress: ExtractionProgress,
        tx: EntityManager = this.entityManager,
    ): Promise<void> {
        await tx.update(
            BrainExtractionEntity,
            { workspaceId, sourceId },
            {
                status: progress.status,
                windowsDone: progress.windowsDone,
                factsProposed: progress.factsProposed,
                windowsTotal: progress.windowsTotal,
                error: progress.error,
                attempts: progress.attempts,
                ...(progress.stage === undefined ? {} : { stage: progress.stage }),
                ...progress.counts,
            },
        )
    }

    /**
     * Closes the reading as done, with the hashes of the passages it covers and the note that says what happened when it is not plain
     * (`ExtractionNote.WindowsSkipped`, `LinesRefused`, `AwaitingFounder`), else none.
     */
    async finish(
        workspaceId: string,
        sourceId: string,
        model: string,
        passageHashes: ReadonlyArray<string>,
        note: EndNote = null,
    ): Promise<void> {
        await this.entityManager.update(
            BrainExtractionEntity,
            { workspaceId, sourceId },
            {
                status: "done",
                error: note,
                model,
                orphanFactIds: [],
                passageHashes: [...passageHashes],
                factsChanged: false,
            },
        )
    }

    /**
     * Adds what one window of the reading left (D-N-10, D-N-11): a skipped call and the lines refused are counted, and the answer is kept
     * among the reading's last 20 notes, in one statement. The note may quote the document: it stays in this row (deleted with the
     * document) and is never logged.
     */
    async note(workspaceId: string, sourceId: string, window: WindowNote): Promise<void> {
        await this.entityManager
            .createQueryBuilder(BrainExtractionEntity, "bx")
            .update()
            .set({
                windowsSkipped: () => "windows_skipped + :skipped",
                linesRefused: () => "lines_refused + :refused",
                linesUnread: () => "lines_unread + :unread",
                answerNotes: () => NOTES_APPENDED,
            })
            .where({ workspaceId, sourceId })
            .setParameters({
                skipped: window.skipped ? 1 : 0,
                refused: window.note.refused,
                unread: window.unread ?? 0,
                note: JSON.stringify([{ ...window.note, answer: window.note.answer.slice(0, NOTE_ANSWER_MAX) }]),
            })
            .execute()
    }

    /** Settles a reading that has not finished as failed, so it never stays running. */
    async fail(workspaceId: string, sourceId: string, note: string): Promise<void> {
        await this.entityManager.update(
            BrainExtractionEntity,
            { workspaceId, sourceId, status: Not("done") },
            { status: "failed", error: note },
        )
    }
}
