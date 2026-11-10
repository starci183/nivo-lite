import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Attaches the listed agents to a provider by their template. */
export class AttachProviderByTemplateInput {
    /** The connected account: the connection id. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string

    /** The agents to attach, among those the template names for the provider. */
    @Field(() => [ID])
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID("4", { each: true })
    @MaxLength(36, { each: true })
    agentIds!: Array<string>
}
