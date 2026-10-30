import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { EmploymentType, JobStatus, PayUnit } from "../../hiring.contracts"

/** The requirements column as stored (snake case keys, any key may be missing). */
export interface HiringJobRequirements {
    /** Skills. */
    readonly skills?: Array<string>
    /** Years of experience. */
    readonly experience_years?: number | null
    /** Experience note. */
    readonly experience_note?: string
    /** Availability. */
    readonly availability?: Array<string>
    /** Must have. */
    readonly must_have?: Array<string>
    /** Nice to have. */
    readonly nice_to_have?: Array<string>
}

/** One entry of the questions column as stored. */
export interface HiringJobQuestion {
    /** The question id. */
    readonly id: string
    /** The question text. */
    readonly text: string
    /** The kind of answer. */
    readonly type: string
    /** Whether an answer is required. */
    readonly required: boolean
    /** The offered choices. */
    readonly choices?: Array<string>
    /** What it scores against. */
    readonly expect?: string | number | Array<string>
}

@Entity({ schema: "public", name: "hiring_jobs" })
/** One job a workspace hires for, with its public page, requirements and screening questions. */
export class HiringJobEntity extends UuidAbstractEntity {
    /** The workspace the job belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The url slug of the public page, unique per workspace. */
    @Column({ name: "slug", type: "text" })
    slug!: string

    /** The job title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The position it fills. */
    @Column({ name: "position", type: "text", default: () => "''::text" })
    position!: string

    /** Full time or part time. */
    @Column({ name: "employment_type", type: "text", default: () => "'full_time'::text" })
    employmentType!: EmploymentType

    /** The working schedule in words. */
    @Column({ name: "schedule", type: "text", default: () => "''::text" })
    schedule!: string

    /** The lower bound of the pay, in dong; a bigint arrives as text. */
    @Column({ name: "pay_min_vnd", type: "bigint", nullable: true })
    payMinVnd!: string | null

    /** The upper bound of the pay, in dong; a bigint arrives as text. */
    @Column({ name: "pay_max_vnd", type: "bigint", nullable: true })
    payMaxVnd!: string | null

    /** What the pay is per: month, hour or shift. */
    @Column({ name: "pay_unit", type: "text", default: () => "'month'::text" })
    payUnit!: PayUnit

    /** Where the job is. */
    @Column({ name: "location", type: "text", default: () => "''::text" })
    location!: string

    /** How many people the job hires. */
    @Column({ name: "headcount", type: "integer", default: () => "1" })
    headcount!: number

    /** The job description. */
    @Column({ name: "description", type: "text", default: () => "''::text" })
    description!: string

    /** The structured requirements. */
    @Column({ name: "requirements", type: "jsonb", default: () => "'{}'::jsonb" })
    requirements!: HiringJobRequirements | null

    /** The screening questions. */
    @Column({ name: "questions", type: "jsonb", default: () => "'[]'::jsonb" })
    questions!: Array<HiringJobQuestion> | null

    /** Draft, open, paused or closed. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: JobStatus

    /** Where the job takes applications. */
    @Column({ name: "channels", type: "text", array: true, default: () => "ARRAY['page'::text, 'chat'::text]" })
    channels!: Array<string>

    /** The generated ad texts, when made. */
    @Column({ name: "ad_variants", type: "jsonb", nullable: true })
    adVariants!: Record<string, unknown> | null

    /** When applications stop. */
    @Column({ name: "closes_at", type: "timestamptz", nullable: true })
    closesAt!: Date | null

    /** The user who created the job. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null
}
