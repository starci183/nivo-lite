import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The last completed editorial plan. */
export class ContentLastPlanType {
    /** The month that the plan covers. */
    @Field()
    month!: string

    /** The number of ideas produced. */
    @Field(() => Int)
    ideas!: number

    /** The planning duration in milliseconds, when recorded. */
    @Field(() => Int, { nullable: true })
    ms!: number | null

    /** When the plan was created, ISO 8601. */
    @Field()
    createdAt!: string
}
