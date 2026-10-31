import { Field, InputType } from "@nestjs/graphql"
import { IsBoolean } from "class-validator"

@InputType()
/** Switches the work of the whole workspace. */
export class SetWorkspaceAgentWorkInput {
    /** True to switch work on. */
    @Field(() => Boolean)
    @IsBoolean()
    enabled!: boolean
}
