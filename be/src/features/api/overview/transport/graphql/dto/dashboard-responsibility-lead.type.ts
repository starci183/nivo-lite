import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The lead a responsibility belongs to. */
export class DashboardResponsibilityLeadType {
    /** The lead id. */
    @Field(() => ID)
    id!: string

    /** The customer name. */
    @Field()
    contactName!: string

    /** The customer company. */
    @Field()
    company!: string

    /** The pipeline stage. */
    @Field()
    stage!: string
}
