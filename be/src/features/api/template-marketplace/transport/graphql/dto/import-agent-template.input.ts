import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"
import { GraphqlJsonObject, NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** A template of the caller to install in this workspace. */
export class ImportAgentTemplateInput {
    /** The template key. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    templateKey!: string

    /** The version. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(100_000)
    version!: number

    /** The values of the parameters, by key. */
    @Field(() => GraphqlJsonObject)
    @IsObject()
    values!: object

    /** The label of the new agent. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(80)
    name?: string
}
