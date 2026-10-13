import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The order whose shipment was recorded. */
export class MarkOrderShippedType {
    /** The order id. */
    @Field(() => ID)
    id!: string

    /** The display order number. */
    @Field()
    orderNo!: string

    /** The durable automation notification, pollable through salesActionStatus. */
    @Field(() => ID)
    notificationId!: string
}
