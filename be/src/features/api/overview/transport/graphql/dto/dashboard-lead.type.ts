import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One lead as far as the overview figures read it. */
export class DashboardLeadType {
    /** The lead id. */
    @Field(() => ID)
    id!: string

    /** The pipeline stage. */
    @Field()
    stage!: string

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** The customer name, or null. */
    @Field(() => String, { nullable: true })
    contactName!: string | null

    /** The customer company, or null. */
    @Field(() => String, { nullable: true })
    company!: string | null
}
