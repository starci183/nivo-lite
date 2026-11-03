import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One branch or node a newer version changes. */
export class UpdateUnitType {
    /** The id to accept it by. */
    @Field(() => ID)
    id!: string

    /** The node. */
    @Field(() => String)
    nodeKey!: string

    /** The branch, or null for a node. */
    @Field(() => String, { nullable: true })
    branchKey!: string | null

    /** `upgrade`, `conflict`, `added` or `removed`. */
    @Field(() => String)
    change!: string
}
