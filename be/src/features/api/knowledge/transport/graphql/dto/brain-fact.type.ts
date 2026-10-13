import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { BrainEvidenceType } from "./brain-evidence.type"

@ObjectType()
/** One fact of the shared brain of a workspace. */
export class BrainFactType {
    /** The fact id. */
    @Field(() => ID)
    id!: string

    /** What it is about: `business`, `product`, `service`, `policy`, `customer`, `person`, `supplier`, `place` or `other`. */
    @Field(() => String)
    subjectType!: string

    /** The normalised subject. */
    @Field(() => String)
    subjectKey!: string

    /** The subject as people write it. */
    @Field(() => String)
    subjectLabel!: string

    /** The normalised attribute. */
    @Field(() => String)
    attribute!: string

    /** The attribute as people write it. */
    @Field(() => String)
    attributeLabel!: string

    /** The value as written. */
    @Field(() => String)
    value!: string

    /** The unit, when written apart from the value. */
    @Field(() => String, { nullable: true })
    unit?: string | null

    /** Who may read it: `public`, `internal` or `restricted`. */
    @Field(() => String)
    scope!: string

    /** The modules that may read a restricted fact. */
    @Field(() => [String])
    modules!: Array<string>

    /** The one agent instance that reads it; null = every instance. */
    @Field(() => ID, { nullable: true })
    installationId?: string | null

    /** Where it stands: `proposed`, `scheduled`, `active`, `superseded`, `rejected` or `expired`. */
    @Field(() => String)
    status!: string

    /** Who it came from: `owner`, `manager`, `document`, `system`, `staff`, `customer` or `ai`. */
    @Field(() => String)
    sourceKind!: string

    /** How far the source is believed, 0 to 100. */
    @Field(() => Int)
    trust!: number

    /** From when it holds, ISO 8601. */
    @Field(() => String, { nullable: true })
    validFrom?: string | null

    /** Until when it holds, ISO 8601. */
    @Field(() => String, { nullable: true })
    validTo?: string | null

    /** `set` (a value) or `retire` (a proposal to stop using the active fact it points at). */
    @Field(() => String)
    proposalKind!: string

    /** What supports it. */
    @Field(() => [BrainEvidenceType])
    evidence!: Array<BrainEvidenceType>

    /** Who proposed it. */
    @Field(() => String)
    proposedBy!: string

    /** When it was proposed, ISO 8601. */
    @Field(() => String)
    proposedAt!: string

    /** Who decided it. */
    @Field(() => String, { nullable: true })
    decidedBy?: string | null

    /** When it was decided, ISO 8601. */
    @Field(() => String, { nullable: true })
    decidedAt?: string | null
}
