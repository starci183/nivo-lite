import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "lead_flows" })
/** The journey of one prospect that came in through Facebook or Instagram: a row of public.lead_flows. */
export class LeadFlowEntity {
    /** The flow id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The owning workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The lead the flow belongs to. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The Meta connection the prospect wrote through. */
    @Column({ name: "connection_id", type: "uuid", nullable: true })
    connectionId!: string | null

    /** The transcript. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** facebook or instagram. */
    @Column({ name: "platform", type: "text", nullable: true })
    platform!: string | null

    /** The Messenger id. */
    @Column({ name: "psid", type: "text", nullable: true })
    psid!: string | null

    /** The Instagram id. */
    @Column({ name: "igsid", type: "text", nullable: true })
    igsid!: string | null

    /** The phone. */
    @Column({ name: "phone", type: "text", nullable: true })
    phone!: string | null

    /** The email. */
    @Column({ name: "email", type: "text", nullable: true })
    email!: string | null

    /** The name. */
    @Column({ name: "name", type: "text", nullable: true })
    name!: string | null

    /** The state of the flow. */
    @Column({ name: "state", type: "text", default: () => "'new'::text" })
    state!: string

    /** Where an escalated flow goes back to. */
    @Column({ name: "resume_state", type: "text", nullable: true })
    resumeState!: string | null

    /** The first touch (jsonb, read through the mapper). */
    @Column({ name: "source", type: "jsonb", default: () => "'{}'::jsonb" })
    source!: unknown

    /** Every touch (jsonb, read through the mapper). */
    @Column({ name: "touches", type: "jsonb", default: () => "'[]'::jsonb" })
    touches!: unknown

    /** The answers (jsonb, read through the mapper). */
    @Column({ name: "answers", type: "jsonb", default: () => "'[]'::jsonb" })
    answers!: unknown

    /** How many questions were asked. */
    @Column({ name: "asked", type: "integer", default: () => "0" })
    asked!: number

    /** The question waiting for an answer. */
    @Column({ name: "pending_question", type: "integer", nullable: true })
    pendingQuestion!: number | null

    /** When the contact was asked for. */
    @Column({ name: "contact_asked_at", type: "timestamptz", nullable: true })
    contactAskedAt!: Date | null

    /** The signals (jsonb, read through the mapper). */
    @Column({ name: "signals", type: "jsonb", default: () => "'{}'::jsonb" })
    signals!: unknown

    /** The score level. */
    @Column({ name: "score", type: "text", nullable: true })
    score!: string | null

    /** Why that score (jsonb, read through the mapper). */
    @Column({ name: "score_reasons", type: "jsonb", default: () => "'[]'::jsonb" })
    scoreReasons!: unknown

    /** When it was scored. */
    @Column({ name: "scored_at", type: "timestamptz", nullable: true })
    scoredAt!: Date | null

    /** The last turn's reading (jsonb, read through the mapper). */
    @Column({ name: "analysis", type: "jsonb", nullable: true })
    analysis!: object | null

    /** When the person last wrote. */
    @Column({ name: "last_user_at", type: "timestamptz", nullable: true })
    lastUserAt!: Date | null

    /** What they last wrote. */
    @Column({ name: "last_user_text", type: "text", nullable: true })
    lastUserText!: string | null

    /** When they were greeted. */
    @Column({ name: "greeted_at", type: "timestamptz", nullable: true })
    greetedAt!: Date | null

    /** When they went to Sales. */
    @Column({ name: "handed_off_at", type: "timestamptz", nullable: true })
    handedOffAt!: Date | null

    /** When they were followed up. */
    @Column({ name: "followed_up_at", type: "timestamptz", nullable: true })
    followedUpAt!: Date | null

    /** When the flow closed. */
    @Column({ name: "closed_at", type: "timestamptz", nullable: true })
    closedAt!: Date | null

    /** When a person took over. */
    @Column({ name: "escalated_at", type: "timestamptz", nullable: true })
    escalatedAt!: Date | null

    /** Why a person took over. */
    @Column({ name: "escalation_reason", type: "text", nullable: true })
    escalationReason!: string | null

    /** Creation instant. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** Last change. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** The agent instance the flow runs for. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null
}
