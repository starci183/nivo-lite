import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that create or update one supplier. */
export class SaveInventorySupplierInput {
    /** The supplier to update; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The supplier name. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    name!: string

    /** The contact person. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    contactName!: string

    /** The order email address. */
    @Field(() => String)
    @IsString()
    @MaxLength(254)
    email!: string

    /** The phone number. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    phone!: string

    /** The Zalo contact. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    zalo!: string

    /** How orders reach the supplier: email, zalo or phone. */
    @Field(() => String)
    @IsString()
    @MaxLength(20)
    channel!: string

    /** The delivery time in days, as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(20)
    leadTime!: string

    /** The payment terms. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    terms!: string

    /** A free note. */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    note!: string
}
