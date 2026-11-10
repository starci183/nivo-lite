import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { AbilityWishInput } from "./ability-wish.input"

@InputType()
/** Attaches an agent to a connected provider with the abilities ticked. */
export class AttachAgentProviderInput {
    /** The agent. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    agentId!: string

    /** The connected account: the connection id. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string

    /** The abilities wanted; an ability left out is off. */
    @Field(() => [AbilityWishInput])
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => AbilityWishInput)
    abilities!: Array<AbilityWishInput>
}
