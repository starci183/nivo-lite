import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsObject, IsString, IsUUID, Matches, MaxLength, ValidateIf } from "class-validator"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@InputType()
/** What an owner changes on one pipeline; every field but the template is optional. */
export class UpdateAutomationPipelineInput {
    /** The template key. */
    @Field()
    @Matches(/^[a-z][a-z0-9_-]{2,60}$/u)
    @MaxLength(61)
    templateKey!: string

    /** Switch on or off. */
    @Field(() => Boolean, { nullable: true })
    @ValidateIf((_, value) => value !== undefined)
    @IsBoolean()
    enabled?: boolean

    /** Hide or restore. */
    @Field(() => Boolean, { nullable: true })
    @ValidateIf((_, value) => value !== undefined)
    @IsBoolean()
    dismissed?: boolean

    /** New setting values, by key. */
    @Field(() => GraphqlJsonObject, { nullable: true })
    @ValidateIf((_, value) => value !== undefined)
    @IsObject()
    values?: object

    /** The approved wording. */
    @Field(() => String, { nullable: true })
    @ValidateIf((_, value) => value !== undefined)
    @IsString()
    @MaxLength(4000)
    body?: string

    /** The answer to send by itself. */
    @Field(() => Boolean, { nullable: true })
    @ValidateIf((_, value) => value !== undefined)
    @IsBoolean()
    autoSend?: boolean

    /** The Google account the spreadsheet is written with. */
    @Field(() => ID, { nullable: true })
    @ValidateIf((_, value) => value !== undefined)
    @IsUUID("4")
    @MaxLength(36)
    googleConnectionId?: string
}
