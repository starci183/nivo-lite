import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How much of its raw document allowance a workspace has used. */
export class KnowledgeUsageType {
    /** The raw bytes its documents hold now. */
    @Field(() => Int)
    usedBytes!: number

    /** The most raw bytes it may hold. */
    @Field(() => Int)
    limitBytes!: number
}
