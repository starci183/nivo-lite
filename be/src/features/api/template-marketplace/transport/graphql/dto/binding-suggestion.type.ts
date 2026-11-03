import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A number of the graph a creator could turn into a parameter. */
export class BindingSuggestionType {
    /** A key to propose. */
    @Field(() => String)
    parameter!: string

    /** `branch_value` or `branch_timeout`. */
    @Field(() => String)
    target!: string

    /** The node. */
    @Field(() => String)
    nodeKey!: string

    /** The branch. */
    @Field(() => String)
    branchKey!: string

    /** Which term of the condition, for a value. */
    @Field(() => Int, { nullable: true })
    termIndex!: number | null
}
