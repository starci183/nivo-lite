import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of create or update one supplier. */
export class SaveSupplierRequest {
    /** The supplier to update; absent creates one. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The supplier name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The contact person. */
    @IsString()
    @MaxLength(80)
    contactName!: string

    /** The order email address. */
    @IsString()
    @MaxLength(200)
    email!: string

    /** The phone number. */
    @IsString()
    @MaxLength(30)
    phone!: string

    /** The Zalo contact. */
    @IsString()
    @MaxLength(60)
    zalo!: string

    /** How orders reach the supplier: email, zalo or phone. */
    @IsString()
    @MaxLength(10)
    channel!: string

    /** The delivery time in days, as typed. */
    @IsString()
    @MaxLength(10)
    leadTime!: string

    /** The payment terms. */
    @IsString()
    @MaxLength(200)
    terms!: string

    /** A free note. */
    @IsString()
    @MaxLength(400)
    note!: string
}
