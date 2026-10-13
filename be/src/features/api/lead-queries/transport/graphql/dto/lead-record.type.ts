import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A customer lead visible in the selected workspace. */
export class LeadRecordType {
    /** The lead id. */
    @Field(() => ID)
    id!: string

    /** The customer's contact name. */
    @Field()
    contactName!: string

    /** The customer's company. */
    @Field()
    company!: string

    /** The channel that brought in the lead. */
    @Field()
    channel!: string

    /** What the customer needs. */
    @Field()
    need!: string

    /** The current sales stage. */
    @Field()
    stage!: string

    /** The context gathered for the customer. */
    @Field(() => String, { nullable: true })
    contextSummary!: string | null

    /** The live or simulated origin, when recorded. */
    @Field(() => String, { nullable: true })
    origin!: string | null

    /** The module installation that owns the lead, when assigned. */
    @Field(() => ID, { nullable: true })
    installationId!: string | null

    /** When the lead was created, ISO 8601. */
    @Field()
    createdAt!: string
}
