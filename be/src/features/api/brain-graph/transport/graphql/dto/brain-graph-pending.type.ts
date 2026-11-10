import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { BrainGraphOriginType } from "./brain-graph-origin.type"

@ObjectType()
/** One change request waiting for the founder ("De nghi sua dang cho"). */
export class BrainGraphPendingType {
    /** The proposal id: what `decideBrainFact` takes (`apply` = Dong y, `reject` = Khong). */
    @Field(() => ID)
    id!: string

    /** The subject key. */
    @Field(() => String)
    subjectKey!: string

    /** The subject. */
    @Field(() => String)
    subjectLabel!: string

    /** The attribute. */
    @Field(() => String)
    attributeLabel!: string

    /** The proposed value (for `retire`: the value it would stop). */
    @Field(() => String)
    value!: string

    /** The unit. */
    @Field(() => String, { nullable: true })
    unit!: string | null

    /** `set` or `retire`. */
    @Field(() => String)
    proposalKind!: string

    /** The truth in force it would replace. */
    @Field(() => ID, { nullable: true })
    currentFactId!: string | null

    /** Its value. */
    @Field(() => String, { nullable: true })
    currentValue!: string | null

    /** Its version. */
    @Field(() => Int, { nullable: true })
    currentVersion!: number | null

    /** Who proposed it: an agent's module (`sales`), a document title, a person. */
    @Field(() => String)
    proposedBy!: string

    /** When. */
    @Field(() => String)
    proposedAt!: string

    /** The source kind it files under. */
    @Field(() => String)
    sourceKind!: string

    /** Where it comes from. */
    @Field(() => BrainGraphOriginType)
    origin!: BrainGraphOriginType

    /** From when it would hold, when stated. */
    @Field(() => String, { nullable: true })
    validFrom!: string | null

    /** Until when it would hold, when stated (else one year from approval). */
    @Field(() => String, { nullable: true })
    validTo!: string | null
}
