import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A decision of the inventory department waiting on the owner. */
export class InventoryPendingType {
    /** The decision id. */
    @Field(() => ID)
    id!: string

    /** The action it decides. */
    @Field(() => String)
    action!: string

    /** One line saying what it asks. */
    @Field(() => String)
    summary!: string

    /** The drafted message. */
    @Field(() => String, { nullable: true })
    draft!: string | null

    /** The purchase order it is about, when it is one. */
    @Field(() => ID, { nullable: true })
    poId!: string | null

    /** When it was asked. */
    @Field(() => String)
    createdAt!: string
}
