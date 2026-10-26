import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One kind of shared knowledge as one view sees it. */
export class AgentKnowledgeLaneType {
    /** `documentPublic`, `documentInternal`, `factPublic`, `factInternal` or `factRestricted`. */
    @Field(() => String)
    lane!: string

    /** Whether the view reads this kind of knowledge, by the same policy that builds the agent's view. */
    @Field(() => Boolean)
    open!: boolean

    /** How many documents or facts of this kind the view reads, or nothing for the customer's view. */
    @Field(() => Int, { nullable: true })
    count?: number | null
}
