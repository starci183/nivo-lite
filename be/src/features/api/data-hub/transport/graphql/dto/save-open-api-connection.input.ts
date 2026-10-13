import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsDefined, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { DataJsonScalar } from "./data-json.type"
import { OpenApiAuthInput } from "./open-api-auth.input"

@InputType()
/** The bounded arguments of saveOpenApiConnection. */
export class SaveOpenApiConnectionInput {
    /** The connection to update; absent creates a new one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The name the owner gives the connection. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    name!: string

    /** The configuration: {specUrl, baseUrl, authType, authName, ops, pulls, tools} (cleaned by the back end). */
    @Field(() => DataJsonScalar)
    @IsDefined()
    config!: unknown

    /** The credential typed; a blank secret keeps the stored one when the type is unchanged. */
    @Field(() => OpenApiAuthInput)
    @ValidateNested()
    @Type(() => OpenApiAuthInput)
    auth!: OpenApiAuthInput

    /** Minutes between scheduled syncs: 15, 60, 360 or 1440; null is manual only. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsIn([15, 60, 360, 1440])
    syncEveryMinutes?: number | null
}
