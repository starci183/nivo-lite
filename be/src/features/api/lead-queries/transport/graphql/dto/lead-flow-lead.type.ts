import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The lead display details attached to a work item. */
export class LeadFlowLeadType {
    /** The linked lead id. */
    @Field(() => ID)
    id!: string

    /** The name of the lead contact. */
    @Field()
    contactName!: string

    /** The company associated with the contact. */
    @Field()
    company!: string

    /** The channel through which the lead arrived. */
    @Field()
    channel!: string
}
