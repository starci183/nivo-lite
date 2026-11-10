import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One day's AI work of one module and one kind of work: exact USD, exact credits (a fraction; the bill rounds only its month total). */
export class CreditWorkUsageType {
    /** The day in Vietnam time, YYYY-MM-DD. */
    @Field()
    day!: string

    /** The module or shared usage bucket. */
    @Field()
    module!: string

    /**
     * The kind of work: node, engine_core, document_read, document_reread, document_critique, learning, chat_turn; a call booked
     * without one is named by its usage kind.
     */
    @Field()
    workKind!: string

    /** Answered calls ("Lượt"). */
    @Field(() => Int)
    calls!: number

    /** Failed tries ("Thử lại"), estimated and never billed. */
    @Field(() => Int)
    failedTries!: number

    /** Prompt and completion tokens of the answers. */
    @Field(() => Float)
    tokens!: number

    /** The exact cost of the answers in USD. */
    @Field(() => Float)
    costUsd!: number

    /** The price of the failed tries in USD (estimated; not billed). */
    @Field(() => Float)
    failedCostUsd!: number

    /** The credits of the answers, an exact fraction ("Credit"). */
    @Field(() => Float)
    credits!: number
}
