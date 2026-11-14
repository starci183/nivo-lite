import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of providerTriggerStates. */
export class GetProviderTriggerStatesInput {
    /** The connected account whose triggers are read. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string
}
