import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Switches the work of one agent. */
export class SetAgentWorkInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** True to switch work on. */
    @Field(() => Boolean)
    @IsBoolean()
    enabled!: boolean
}
