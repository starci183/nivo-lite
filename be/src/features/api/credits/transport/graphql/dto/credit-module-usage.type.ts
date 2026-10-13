import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One module's use in the current month. */
export class CreditModuleUsageType {
    /** The module or shared usage bucket. */
    @Field()
    module!: string

    /** Number of model calls. */
    @Field(() => Float)
    calls!: number

    /** Prompt and completion tokens. */
    @Field(() => Float)
    tokens!: number

    /** Model cost in USD. */
    @Field(() => Float)
    costUsd!: number

    /** Credits consumed. */
    @Field(() => Float)
    credits!: number
}
