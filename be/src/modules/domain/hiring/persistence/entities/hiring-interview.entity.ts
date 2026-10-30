import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { InterviewStatus } from "../../hiring.contracts"

/** One entry of the proposed slots column as stored. */
export interface HiringInterviewSlot {
    /** The start. */
    readonly start: string
    /** The end. */
    readonly end: string
}

@Entity({ schema: "public", name: "hiring_interviews" })
/** One interview of a candidate: the times proposed, the time chosen and where it stands. */
export class HiringInterviewEntity extends UuidAbstractEntity {
    /** The workspace the interview belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The candidate. */
    @Column({ name: "candidate_id", type: "uuid" })
    candidateId!: string

    /** The job. */
    @Column({ name: "job_id", type: "uuid" })
    jobId!: string

    /** The member who interviews, when picked. */
    @Column({ name: "interviewer_user_id", type: "uuid", nullable: true })
    interviewerUserId!: string | null

    /** The interviewer's display name. */
    @Column({ name: "interviewer_name", type: "text", default: () => "''::text" })
    interviewerName!: string

    /** In person or online. */
    @Column({ name: "mode", type: "text", default: () => "'in_person'::text" })
    mode!: "in_person" | "online"

    /** Where it happens. */
    @Column({ name: "location", type: "text", default: () => "''::text" })
    location!: string

    /** How long it takes, in minutes. */
    @Column({ name: "duration_min", type: "integer", default: () => "30" })
    durationMin!: number

    /** The slots proposed to the candidate. */
    @Column({ name: "proposed_slots", type: "jsonb", default: () => "'[]'::jsonb" })
    proposedSlots!: Array<HiringInterviewSlot> | null

    /** The chosen slot's start. */
    @Column({ name: "slot_start", type: "timestamptz", nullable: true })
    slotStart!: Date | null

    /** The chosen slot's end. */
    @Column({ name: "slot_end", type: "timestamptz", nullable: true })
    slotEnd!: Date | null

    /** Where the interview stands. */
    @Column({ name: "status", type: "text", default: () => "'proposed'::text" })
    status!: InterviewStatus

    /** The public answer token. */
    @Column({ name: "token", type: "text" })
    token!: string

    /** The decision the sending waits on, when it does. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** When the reminder went out. */
    @Column({ name: "reminder_sent_at", type: "timestamptz", nullable: true })
    reminderSentAt!: Date | null

    /** A note for the interviewer. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string
}
