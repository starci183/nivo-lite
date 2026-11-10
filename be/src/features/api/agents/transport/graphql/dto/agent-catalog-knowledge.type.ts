import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one agent reads of the shared knowledge, counted through its own lens. */
export class AgentCatalogKnowledgeType {
    /** `customer` or `internal`: a customer-facing agent reads no internal document. */
    @Field()
    audience!: string

    /** The documents the lens may read. */
    @Field(() => Int)
    documents!: number

    /** The facts of the lens the owner approved. */
    @Field(() => Int)
    factsApproved!: number

    /** The facts of the lens, approved and waiting. */
    @Field(() => Int)
    factsTotal!: number

    /** The facts of the lens that wait for the owner. */
    @Field(() => Int)
    factsWaiting!: number
}
