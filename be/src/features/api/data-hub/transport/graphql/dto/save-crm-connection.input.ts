import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { CrmAuthInput } from "./crm-auth.input"

@InputType()
/** The bounded arguments of saveCrmConnection. */
export class SaveCrmConnectionInput {
    /** The connection to update; absent creates a new one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The CRM id: a package template or the shop's own. */
    @Field(() => String)
    @IsString()
    @MaxLength(64)
    crmId!: string

    /** The API base URL. */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    baseUrl!: string

    /** Where the live OpenAPI document is; only for a CRM no package declares. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    swaggerUrl?: string | null

    /** The key as typed. */
    @Field(() => CrmAuthInput)
    @ValidateNested()
    @Type(() => CrmAuthInput)
    auth!: CrmAuthInput
}
