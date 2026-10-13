import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One supplier of the workbench. */
export class InventorySupplierType {
    /** The supplier id. */
    @Field(() => ID)
    id!: string

    /** The supplier name. */
    @Field(() => String)
    name!: string

    /** The contact person. */
    @Field(() => String)
    contactName!: string

    /** The order email address. */
    @Field(() => String)
    email!: string

    /** The phone number. */
    @Field(() => String)
    phone!: string

    /** The Zalo contact. */
    @Field(() => String)
    zalo!: string

    /** How orders reach the supplier. */
    @Field(() => String)
    channel!: string

    /** The delivery time in days. */
    @Field(() => Int)
    leadTimeDays!: number

    /** The payment terms. */
    @Field(() => String)
    paymentTerms!: string

    /** A free note. */
    @Field(() => String)
    note!: string
}
