import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A recorded lead outcome and any handoff to Accounting. */
export class RecordOutcomeType {
    /** The lead id. */
    @Field(() => ID)
    leadId!: string

    /** The stage now recorded. */
    @Field()
    stage!: string

    /** The customer name. */
    @Field()
    contactName!: string

    /** The customer company. */
    @Field()
    company!: string

    /** The channel the lead came through. */
    @Field()
    channel!: string

    /** What the customer needs. */
    @Field()
    need!: string

    /** Whether a won deal was handed to an active Accounting agent. */
    @Field()
    handedToAccounting!: boolean
}
