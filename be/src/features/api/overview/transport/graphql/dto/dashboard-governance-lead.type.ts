import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A lead row behind the governance figures. */
export class DashboardGovernanceLeadType {
    /** The lead id. */
    @Field(() => ID)
    id!: string

    /** The customer name, or null. */
    @Field(() => String, { nullable: true })
    contactName!: string | null

    /** The customer company, or null. */
    @Field(() => String, { nullable: true })
    company!: string | null

    /** `live`, `simulated` or null. */
    @Field(() => String, { nullable: true })
    origin!: string | null

    /** The pipeline stage. */
    @Field()
    stage!: string

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string
}
