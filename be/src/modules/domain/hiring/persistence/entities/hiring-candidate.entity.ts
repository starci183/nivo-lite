import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { ApplicationSource, ScoreLabel, ScoreReason, Stage } from "../../hiring.contracts"

/** One entry of the answers column as stored. */
export interface HiringCandidateAnswer {
    /** The question id. */
    readonly question_id: string
    /** The question text. */
    readonly question: string
    /** The answer. */
    readonly answer: string
}

@Entity({ schema: "public", name: "hiring_candidates" })
/** One applicant for a job with the answers, the CV, the advisory score and the pipeline stage. */
export class HiringCandidateEntity extends UuidAbstractEntity {
    /** The workspace the candidate applied to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The job applied for. */
    @Column({ name: "job_id", type: "uuid" })
    jobId!: string

    /** The name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The phone. */
    @Column({ name: "phone", type: "text", default: () => "''::text" })
    phone!: string

    /** The email. */
    @Column({ name: "email", type: "text", default: () => "''::text" })
    email!: string

    /** Where the application came from. */
    @Column({ name: "source", type: "text", default: () => "'page'::text" })
    source!: ApplicationSource

    /** The chat conversation of a chat application. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The CV storage path. */
    @Column({ name: "cv_path", type: "text", nullable: true })
    cvPath!: string | null

    /** The CV file name. */
    @Column({ name: "cv_name", type: "text", nullable: true })
    cvName!: string | null

    /** The CV media type. */
    @Column({ name: "cv_mime", type: "text", nullable: true })
    cvMime!: string | null

    /** The CV size in bytes. */
    @Column({ name: "cv_size", type: "integer", nullable: true })
    cvSize!: number | null

    /** The answers to the screening questions. */
    @Column({ name: "answers", type: "jsonb", default: () => "'[]'::jsonb" })
    answers!: Array<HiringCandidateAnswer> | null

    /** The availability the candidate stated. */
    @Column({ name: "availability", type: "text", default: () => "''::text" })
    availability!: string

    /** The advisory screening score, 0 to 100. */
    @Column({ name: "score", type: "integer", nullable: true })
    score!: number | null

    /** The screening verdict. */
    @Column({ name: "score_label", type: "text", nullable: true })
    scoreLabel!: ScoreLabel | null

    /** The per-criterion findings of the screening. */
    @Column({ name: "score_reasons", type: "jsonb", default: () => "'[]'::jsonb" })
    scoreReasons!: Array<ScoreReason> | null

    /** The one-paragraph summary of the screening. */
    @Column({ name: "score_summary", type: "text", nullable: true })
    scoreSummary!: string | null

    /** When the screening ran. */
    @Column({ name: "screened_at", type: "timestamptz", nullable: true })
    screenedAt!: Date | null

    /** The pipeline stage. */
    @Column({ name: "stage", type: "text", default: () => "'applied'::text" })
    stage!: Stage

    /** When the stage last changed. */
    @Column({ name: "stage_changed_at", type: "timestamptz", default: () => "now()" })
    stageChangedAt!: Date

    /** Why a rejected candidate was refused. */
    @Column({ name: "rejected_reason", type: "text", nullable: true })
    rejectedReason!: string | null

    /** The manager's private notes. */
    @Column({ name: "notes", type: "text", default: () => "''::text" })
    notes!: string

    /** The staff row the hire became, when linked. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null
}
