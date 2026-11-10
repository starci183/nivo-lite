import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One fact only one agent reads. */
export class AgentKnowledgeOwnFactType {
    /** The fact. */
    @Field(() => ID)
    id!: string

    /** What it is about. */
    @Field()
    label!: string

    /** The value with its unit. */
    @Field()
    value!: string

    /** Whether the owner approved it. */
    @Field()
    isApproved!: boolean
}
