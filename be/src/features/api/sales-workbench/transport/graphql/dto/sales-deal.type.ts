import { Field, ObjectType, ID, Float } from "@nestjs/graphql"

@ObjectType()
/** One Sales pipeline card. */
export class SalesDealType {
    /** The lead id. */
    @Field(() => ID)
    leadId!: string

    /** The customer. */
    @Field(() => String)
    customer!: string

    /** The company. */
    @Field(() => String)
    company!: string

    /** The channel. */
    @Field(() => String)
    channel!: string

    /** The need. */
    @Field(() => String)
    need!: string

    /** The stage. */
    @Field(() => String)
    stage!: string

    /** The value vnd. */
    @Field(() => Float, { nullable: true })
    valueVnd!: number | null

    /** The value source. */
    @Field(() => String, { nullable: true })
    valueSource!: string | null

    /** The next step. */
    @Field(() => String, { nullable: true })
    nextStep!: string | null

    /** The due at. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** The owner. */
    @Field(() => String, { nullable: true })
    owner!: string | null

    /** The created at. */
    @Field(() => String)
    createdAt!: string

    /** The closed reason. */
    @Field(() => String, { nullable: true })
    closedReason!: string | null

    /** The closed at. */
    @Field(() => String, { nullable: true })
    closedAt!: string | null
}
