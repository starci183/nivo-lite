import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Turns the trigger of a connected account on or off. */
export class SetProviderTriggerEnabledInput {
    /** The connected account. */
    @Field(() => ID)
    @IsString()
    @MaxLength(36)
    @IsUUID()
    connectionId!: string

    /** The trigger name inside the provider (`transaction.received`). */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    trigger!: string

    /** On or off. */
    @Field(() => Boolean)
    @IsBoolean()
    enabled!: boolean

    /** Turning on: catch up on the events missed while it was off instead of starting from now; taken only where it can catch up. */
    @Field(() => Boolean, { defaultValue: false })
    @IsBoolean()
    catchUp!: boolean
}
