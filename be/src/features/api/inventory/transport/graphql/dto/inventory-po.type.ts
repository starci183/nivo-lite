import { Field, ID, Int, Float, ObjectType } from "@nestjs/graphql"
import { InventoryPoLineType } from "./inventory-po-line.type"

@ObjectType()
/** One purchase order with its lines. */
export class InventoryPoType {
    /** The purchase order id. */
    @Field(() => ID)
    id!: string

    /** The order number. */
    @Field(() => String)
    poNo!: string

    /** The supplier. */
    @Field(() => ID, { nullable: true })
    supplierId!: string | null

    /** The supplier name. */
    @Field(() => String)
    supplierName!: string

    /** The supplier channel. */
    @Field(() => String, { nullable: true })
    channel!: string | null

    /** The status. */
    @Field(() => String)
    status!: string

    /** The order value. */
    @Field(() => Float)
    totalVnd!: number

    /** The expected date. */
    @Field(() => String, { nullable: true })
    expectedAt!: string | null

    /** The order message. */
    @Field(() => String)
    message!: string

    /** How the order went out. */
    @Field(() => String, { nullable: true })
    sentVia!: string | null

    /** Why it was not sent. */
    @Field(() => String, { nullable: true })
    sendNote!: string | null

    /** The send decision. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** How many reminders went out. */
    @Field(() => Int)
    reminders!: number

    /** Who raised it. */
    @Field(() => String)
    source!: string

    /** When it was raised. */
    @Field(() => String)
    createdAt!: string

    /** The lines. */
    @Field(() => [InventoryPoLineType])
    lines!: ReadonlyArray<InventoryPoLineType>
}
