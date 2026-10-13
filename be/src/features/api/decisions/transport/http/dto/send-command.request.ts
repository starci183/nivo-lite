import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    MinLength,
    ValidateNested,
} from "class-validator"
import { FieldValueRequest } from "./field-value.request"

/** The bounded HTTP request that sends a command to an agent as the owner. */
export class SendCommandRequest {
    /** The receiving module. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(60)
    to!: string

    /** The command key of the receiver. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(80)
    command!: string

    /** Why, in one line. */
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    reason!: string

    /** The kind of record the command is about. */
    @IsOptional()
    @IsIn(["lead", "order", "invoice", "transaction", "conversation", "inbound", "purchase_order", "stock"])
    subjectType?: "lead" | "order" | "invoice" | "transaction" | "conversation" | "inbound" | "purchase_order" | "stock"

    /** The record the command is about. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    subjectId?: string

    /** The customer the command is about. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId?: string

    /** The other payload fields the command declares. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @ValidateNested({ each: true })
    @Type(() => FieldValueRequest)
    fields?: Array<FieldValueRequest>
}
