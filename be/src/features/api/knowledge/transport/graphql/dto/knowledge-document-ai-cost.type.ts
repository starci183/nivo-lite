import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The model use of one kind of work on a document, exact (credits are fractions, never rounded per call). */
export class KnowledgeAiWorkCostType {
    /** Answered calls ("Luot"). */
    @Field(() => Int)
    calls!: number

    /** Failed tries ("Thu lai"), estimated and never billed. */
    @Field(() => Int)
    failedTries!: number

    /** Prompt and completion tokens of the answers. */
    @Field(() => Int)
    tokens!: number

    /** The exact cost of the answers in USD. */
    @Field(() => Float)
    costUsd!: number

    /** The credits of the answers, an exact fraction ("Credit"). */
    @Field(() => Float)
    credits!: number

    /** The price of the failed tries in USD (estimated; not billed). */
    @Field(() => Float)
    failedCostUsd!: number

    /** The credits of the failed tries, an exact fraction. */
    @Field(() => Float)
    failedCredits!: number
}

@ObjectType()
/** What a document cost: to read it, to critique it, to read it again, and in all. Owner and manager only (null for staff). */
export class KnowledgeDocumentAiCostType {
    /** Its first reading (transcription, passage vectors, facts, same-fact judgements, fact vectors, relations). */
    @Field(() => KnowledgeAiWorkCostType)
    read!: KnowledgeAiWorkCostType

    /** Its critique. */
    @Field(() => KnowledgeAiWorkCostType)
    critique!: KnowledgeAiWorkCostType

    /** Its later readings after a change. */
    @Field(() => KnowledgeAiWorkCostType)
    reread!: KnowledgeAiWorkCostType

    /** All of it. */
    @Field(() => KnowledgeAiWorkCostType)
    total!: KnowledgeAiWorkCostType

    /** The models that served its calls ("Model"). */
    @Field(() => [String])
    models!: ReadonlyArray<string>
}
