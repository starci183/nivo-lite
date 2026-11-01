import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What taking a batch of facts back did. */
export class BrainBulkUndoneType {
    /** How many facts wait for review again. */
    @Field(() => Int)
    restored!: number

    /** How many facts stay as they are because they were changed since. */
    @Field(() => Int)
    kept!: number
}
