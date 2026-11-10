import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator"
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

    /** The provider key. */
    @Field(() => String)
    @IsString()
    @MaxLength(31)
    @Matches(/^[a-z][a-z0-9_-]{1,30}$/u)
    provider!: string

    /** The abilities wanted; an ability left out is off. */
    @Field(() => [AbilityWishInput])
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => AbilityWishInput)
    abilities!: Array<AbilityWishInput>
}
