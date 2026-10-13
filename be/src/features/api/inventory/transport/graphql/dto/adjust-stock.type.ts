import { Field, ID, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What changing one item's quantity by hand answers. */
export class AdjustStockType {
    /** `applied` when the change is in, `waiting` when the owner must approve it. */
    @Field(() => String)
    state!: string

    /** The level before the change. */
    @Field(() => Float, { nullable: true })
    before!: number | null

    /** The level after the change. */
    @Field(() => Float, { nullable: true })
    after!: number | null

    /** The decision waiting for the owner. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null
}
