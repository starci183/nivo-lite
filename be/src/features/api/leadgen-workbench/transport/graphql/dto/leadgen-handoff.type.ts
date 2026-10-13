import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One prospect handed to Sales and where its classification stands. */
export class LeadGenHandoffType {
    /** The handoff work item id. */
    @Field(() => String)
    key!: string
    /** The lead id. */
    @Field(() => String)
    leadId!: string
    /** The customer name. */
    @Field(() => String)
    name!: string
    /** The lead temperature. */
    @Field(() => String, { nullable: true })
    score!: string | null
    /** The time of handoff. */
    @Field(() => String)
    at!: string
    /** The classification work status, when started. */
    @Field(() => String, { nullable: true })
    classify!: string | null
    /** The lead stage. */
    @Field(() => String)
    stage!: string
    /** The lead journey path. */
    @Field(() => String)
    href!: string
}
