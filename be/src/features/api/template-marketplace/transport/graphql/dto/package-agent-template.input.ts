import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    MaxLength,
    ValidateNested,
} from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"
import { LikenessClaimInput } from "./likeness-claim.input"
import { ParameterBindingInput } from "./parameter-binding.input"
import { TemplateParameterInput } from "./template-parameter.input"
import { TemplateTextInput } from "./template-text.input"

@InputType()
/** A version of an agent to package. */
export class PackageAgentTemplateInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    agentId!: string

    /** The frozen graph version to package. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    graphVersionId!: string

    /** The key of the template. */
    @Field(() => String)
    @Matches(/^[a-z][a-z0-9-]{2,59}$/)
    @MaxLength(60)
    key!: string

    /** The name on the card. */
    @Field(() => TemplateTextInput)
    @ValidateNested()
    @Type(() => TemplateTextInput)
    name!: TemplateTextInput

    /** The summary. */
    @Field(() => TemplateTextInput)
    @ValidateNested()
    @Type(() => TemplateTextInput)
    summary!: TemplateTextInput

    /** The category key. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    category!: string

    /** The settings of the buyer. */
    @Field(() => [TemplateParameterInput])
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => TemplateParameterInput)
    parameters!: Array<TemplateParameterInput>

    /** Where they land in the graph. */
    @Field(() => [ParameterBindingInput])
    @IsArray()
    @ArrayMaxSize(60)
    @ValidateNested({ each: true })
    @Type(() => ParameterBindingInput)
    bindings!: Array<ParameterBindingInput>

    /** The published public documents to start the buyer with. */
    @Field(() => [ID])
    @IsArray()
    @ArrayMaxSize(20)
    @IsUUID(undefined, { each: true })
    starterDocumentIds!: Array<string>

    /** The voice of the agent. */
    @Field(() => String)
    @IsString()
    @MaxLength(4000)
    soul!: string

    /** The real person the persona is modelled on, when it is one. */
    @Field(() => LikenessClaimInput, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @ValidateNested()
    @Type(() => LikenessClaimInput)
    likeness?: LikenessClaimInput

    /** What changed. */
    @Field(() => String)
    @IsString()
    @MaxLength(2000)
    changelog!: string

    /** True when the buyer must read the version before taking it. */
    @Field(() => Boolean)
    @IsBoolean()
    breaking!: boolean
}
