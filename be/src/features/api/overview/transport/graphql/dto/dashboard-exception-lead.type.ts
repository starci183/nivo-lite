import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The customer behind a work item exception. */
export class DashboardExceptionLeadType {
    /** The lead id. */
    @Field(() => ID)
    id!: string

    /** The customer name. */
    @Field()
    contactName!: string

    /** The customer company. */
    @Field()
    company!: string

    /** The channel the customer came from. */
    @Field()
    channel!: string
}
