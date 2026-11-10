import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** Attaches the listed agents to a provider by their template. */
export class AttachProviderByTemplateInput {
    /** The provider key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
    @Matches(/^[a-z][a-z0-9_-]{1,30}$/u)
    provider!: string

    /** The agents to attach, among those the template names for the provider. */
    @Field(() => [ID])
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID("4", { each: true })
    @MaxLength(36, { each: true })
    agentIds!: Array<string>
}
