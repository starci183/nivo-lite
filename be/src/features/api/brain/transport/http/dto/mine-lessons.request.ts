import { IsString, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that studies the corrections of one agent. */
export class MineLessonsRequest {
    /** The agent whose corrections are studied. */
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module!: string
}
