import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The storage a workspace keeps against what its plan includes. */
export class BillingStorageType {
    /** Bytes in the knowledge and media buckets. */
    @Field(() => Float)
    usedBytes!: number

    /** Bytes the plan includes; null is not capped. */
    @Field(() => Float, { nullable: true })
    quotaBytes!: number | null
}
