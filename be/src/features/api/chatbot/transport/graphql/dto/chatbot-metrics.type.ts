import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The bounded inbox sample and response figures. */
export class ChatbotMetricsType {
    /** The today value. */
    @Field(() => Int)
    today!: number

    /** The waiting value. */
    @Field(() => Int)
    waiting!: number

    /** The p50 first response min value. */
    @Field(() => Float, { nullable: true })
    p50FirstResponseMin!: number | null

    /** The sample value. */
    @Field(() => Int)
    sample!: number

    /** The leads captured7d value. */
    @Field(() => Int)
    leadsCaptured7d!: number
}
