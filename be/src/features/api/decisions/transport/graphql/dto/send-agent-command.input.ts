import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
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
import { FieldValueInput } from "./field-value.input"

@InputType()
/** Sends a command to an agent as the owner. */
export class SendAgentCommandInput {
    /** The receiving module. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(60)
    to!: string

    /** The command key of the receiver. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(80)
    command!: string

    /** Why, in one line. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    reason!: string

    /** The kind of record the command is about. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsIn(["lead", "order", "invoice", "transaction", "conversation", "inbound", "purchase_order", "stock"])
    subjectType?: "lead" | "order" | "invoice" | "transaction" | "conversation" | "inbound" | "purchase_order" | "stock"

    /** The record the command is about. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsUUID("4")
    @MaxLength(36)
    subjectId?: string

    /** The customer the command is about. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsUUID("4")
    @MaxLength(36)
    leadId?: string

    /** The other payload fields the command declares. */
    @Field(() => [FieldValueInput], { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsArray()
    @ArrayMaxSize(30)
    @ValidateNested({ each: true })
    @Type(() => FieldValueInput)
    fields?: Array<FieldValueInput>
}
