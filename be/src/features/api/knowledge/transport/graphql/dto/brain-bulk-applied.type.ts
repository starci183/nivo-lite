import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What applying the checked facts of one document together did. */
export class BrainBulkAppliedType {
    /** The batch the applied facts belong to; it takes them back. */
    @Field(() => String)
    batchId!: string

    /** How many facts were applied. */
    @Field(() => Int)
    applied!: number

    /** How many waiting facts of the document were left for a person to review. */
    @Field(() => Int)
    skipped!: number
}
