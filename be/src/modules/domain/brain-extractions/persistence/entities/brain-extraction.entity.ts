import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "brain_extractions" })
/** One row of public.brain_extractions. */
export class BrainExtractionEntity extends AbstractEntity {
    /** The source id. */
    @PrimaryColumn({ name: "source_id", type: "uuid" })
    sourceId!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: "queued" | "running" | "done" | "failed" | "blocked_credits" | "awaiting_critique" | "at_ceiling"

    /** The facts proposed. */
    @Column({ name: "facts_proposed", type: "int", default: () => "0" })
    factsProposed!: number

    /** The error. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The model. */
    @Column({ name: "model", type: "text", nullable: true })
    model!: string | null

    /** The prompt version. */
    @Column({ name: "prompt_version", type: "int" })
    promptVersion!: number

    /** The content hash. */
    @Column({ name: "content_hash", type: "text", nullable: true })
    contentHash!: string | null

    /** The windows total. */
    @Column({ name: "windows_total", type: "int", default: () => "0" })
    windowsTotal!: number

    /** The windows done. */
    @Column({ name: "windows_done", type: "int", default: () => "0" })
    windowsDone!: number

    /** The attempts. */
    @Column({ name: "attempts", type: "int", default: () => "0" })
    attempts!: number

    /** The orphan fact ids. */
    @Column({ name: "orphan_fact_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    orphanFactIds!: Array<string>

    /** The hashes of the passages the last finished reading covered. */
    @Column({ name: "passage_hashes", type: "text", array: true, default: () => "'{}'::text[]" })
    passageHashes!: Array<string>

    /** Whether this reading already withdrew facts, so a retry still asks for the review. */
    @Column({ name: "facts_changed", type: "boolean", default: () => "false" })
    factsChanged!: boolean

    /** The stage of the truths work: triage, extract or settle; null for a reading from before the stages. */
    @Column({ name: "stage", type: "text", nullable: true })
    stage!: "triage" | "extract" | "settle" | null

    /** The passages of the document. */
    @Column({ name: "passages_total", type: "int", default: () => "0" })
    passagesTotal!: number

    /** The passages triage has judged. */
    @Column({ name: "passages_triaged", type: "int", default: () => "0" })
    passagesTriaged!: number

    /** The passages that state a rule of the shop. */
    @Column({ name: "passages_kept", type: "int", default: () => "0" })
    passagesKept!: number

    /** The truths of the document put in force directly. */
    @Column({ name: "facts_applied", type: "int", default: () => "0" })
    factsApplied!: number

    /** The truths of the document the founder is asked about. */
    @Column({ name: "facts_asked", type: "int", default: () => "0" })
    factsAsked!: number

    /** The truths of the document that wait: not the founder's document, not critiqued yet, or over the ceiling. */
    @Column({ name: "facts_waiting", type: "int", default: () => "0" })
    factsWaiting!: number

    /** Reading calls whose answer could not be read even after a follow-up: skipped, read again by the next reading. */
    @Column({ name: "windows_skipped", type: "int", default: () => "0" })
    windowsSkipped!: number

    /** Answer lines not kept over the reading (not a truth line, or a value its passage does not hold). */
    @Column({ name: "lines_refused", type: "int", default: () => "0" })
    linesRefused!: number

    /**
     * The last refused or skipped answers of the reading (`AnswerNote`): the raw reply may quote the document, so it lives in the tenant's
     * row, deleted with the document, and is never logged. Not loaded by default (a diagnosis reads it by SQL on the row).
     */
    @Column({ name: "answer_notes", type: "jsonb", default: () => "'[]'::jsonb", select: false })
    answerNotes!: Array<Record<string, unknown>>

    /** Lines of rule material neither read into a truth nor skipped by the reading, even after a follow-up (TRIAGE-3): counted, never silent. */
    @Column({ name: "lines_unread", type: "int", default: () => "0" })
    linesUnread!: number

    /**
     * What the document IS, as the strong model read it once for this text (TRIAGE-2: rules, records, log, reference or mixed, one line
     * of reason, the sections of a mixed document and the tables): `brain/document-nature.policy.ts` `NatureReading`. Null until read.
     */
    @Column({ name: "document_nature", type: "jsonb", nullable: true })
    documentNature!: Record<string, unknown> | null

    /** The founder's answer on what the document is (`NatureOverride`: nature, by, at), over the model's; null when he gave none. */
    @Column({ name: "nature_override", type: "jsonb", nullable: true })
    natureOverride!: Record<string, unknown> | null
}
