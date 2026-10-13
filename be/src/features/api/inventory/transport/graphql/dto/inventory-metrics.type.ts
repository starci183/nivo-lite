import { Field, Int, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The figures of the workbench ribbon. */
export class InventoryMetricsType {
    /** The stock value in dong. */
    @Field(() => Float)
    valueVnd!: number

    /** Active items. */
    @Field(() => Int)
    itemCount!: number

    /** Items at or below the reorder point. */
    @Field(() => Int)
    lowCount!: number

    /** Items out of stock. */
    @Field(() => Int)
    outCount!: number

    /** Purchase orders still open. */
    @Field(() => Int)
    openPos!: number

    /** Decisions waiting. */
    @Field(() => Int)
    pendingCount!: number
}
