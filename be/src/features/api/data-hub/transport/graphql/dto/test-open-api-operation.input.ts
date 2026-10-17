import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsDefined, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { DataJsonScalar } from "../data-json.mapper"
import { OpenApiAuthInput } from "./open-api-auth.input"

@InputType()
/** The bounded arguments of testOpenApiOperation. */
export class TestOpenApiOperationInput {
    /** The connection being edited, so blank secrets use the stored ones; absent for a new connection. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The API's base URL. */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    baseUrl!: string

    /** The credential typed. */
    @Field(() => OpenApiAuthInput)
    @ValidateNested()
    @Type(() => OpenApiAuthInput)
    auth!: OpenApiAuthInput

    /** The operation to try (only GET): {id, method, path, summary, params, hasBody}; cleaned by the back end. */
    @Field(() => DataJsonScalar)
    @IsDefined()
    op!: unknown

    /** The fixed query string, like status=open. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    fixedQuery!: string

    /** The dotted path of the items array in the answer; empty finds the first list. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    itemsPath!: string
}
