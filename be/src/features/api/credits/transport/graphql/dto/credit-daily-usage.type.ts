import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One day's use in the current month. */
export class CreditDailyUsageType {
    /** The Vietnam day, YYYY-MM-DD. */
    @Field()
    day!: string

    /** Prompt and completion tokens. */
    @Field(() => Float)
    tokens!: number

    /** Credits consumed. */
    @Field(() => Float)
    credits!: number
}
