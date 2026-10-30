import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type {
    BrainSubjectType,
    Evidence,
    FactSource,
    FactStatus,
    ProposalKind,
    Scope,
} from "../../brain-facts.contracts"

@Entity({ schema: "public", name: "brain_facts" })
/** One row of public.brain_facts: a thing the business knows, with where it came from and when it holds. */
export class BrainFactEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module installation the fact belongs to; null for the whole workspace. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** What kind of subject the fact is about. */
    @Column({ name: "subject_type", type: "text", default: () => "'business'::text" })
    subjectType!: BrainSubjectType

    /** The subject key. */
    @Column({ name: "subject_key", type: "text" })
    subjectKey!: string

    /** The subject label. */
    @Column({ name: "subject_label", type: "text" })
    subjectLabel!: string

    /** The attribute key. */
    @Column({ name: "attribute", type: "text" })
    attribute!: string

    /** The attribute label. */
    @Column({ name: "attribute_label", type: "text" })
    attributeLabel!: string

    /** The value as text. */
    @Column({ name: "value", type: "text" })
    value!: string

    /** The value as a number, kept as the database text. */
    @Column({ name: "value_number", type: "numeric", nullable: true })
    valueNumber!: string | null

    /** The unit of the value. */
    @Column({ name: "unit", type: "text", nullable: true })
    unit!: string | null

    /** Who may see the fact. */
    @Column({ name: "scope", type: "text", default: () => "'internal'::text" })
    scope!: Scope

    /** The modules a restricted fact is visible to. */
    @Column({ name: "modules", type: "text", array: true, default: () => "'{}'::text[]" })
    modules!: Array<string>

    /** The lifecycle status. */
    @Column({ name: "status", type: "text", default: () => "'proposed'::text" })
    status!: FactStatus

    /** Where the fact came from. */
    @Column({ name: "source_kind", type: "text" })
    sourceKind!: FactSource

    /** How far the source is trusted, 0 to 100. */
    @Column({ name: "trust", type: "smallint" })
    trust!: number

    /** When the fact starts to hold. */
    @Column({ name: "valid_from", type: "timestamptz", nullable: true })
    validFrom!: Date | null

    /** When the fact stops holding. */
    @Column({ name: "valid_to", type: "timestamptz", nullable: true })
    validTo!: Date | null

    /** The fact this one replaces. */
    @Column({ name: "supersedes_id", type: "uuid", nullable: true })
    supersedesId!: string | null

    /** The fact this proposal disagrees with. */
    @Column({ name: "conflict_with", type: "uuid", nullable: true })
    conflictWith!: string | null

    /** The evidence the fact rests on. */
    @Column({ name: "evidence", type: "jsonb", default: () => "'[]'::jsonb" })
    evidence!: Array<Evidence>

    /** Who proposed it. */
    @Column({ name: "proposed_by", type: "text" })
    proposedBy!: string

    /** When it was proposed. */
    @Column({ name: "proposed_at", type: "timestamptz", default: () => "now()" })
    proposedAt!: Date

    /** Who decided it. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** When it was decided. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** The note given with the decision. */
    @Column({ name: "decision_note", type: "text", nullable: true })
    decisionNote!: string | null

    /** Whether the proposal sets a value or retires one. */
    @Column({ name: "proposal_kind", type: "text", default: () => "'set'::text" })
    proposalKind!: ProposalKind
}
