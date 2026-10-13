import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Book Adjustment returned by GraphQL. */
export class AccountingBookAdjustmentType {
    /** id. */
    @Field(() => String)
    id!: string

    /** target Type. */
    @Field(() => String)
    targetType!: string

    /** target Id. */
    @Field(() => String)
    targetId!: string

    /** note. */
    @Field(() => String)
    note!: string

    /** corrected Amount. */
    @Field(() => Float, { nullable: true })
    correctedAmount!: number | null

    /** created By. */
    @Field(() => String)
    createdBy!: string

    /** created At. */
    @Field(() => String)
    createdAt!: string
}
