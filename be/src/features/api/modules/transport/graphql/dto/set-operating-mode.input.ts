import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Sets how an agent runs. */
export class SetOperatingModeInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The mode the web sends; nothing reads it (the switch is gone). */
    @Field()
    @IsIn(["assist", "autopilot"])
    mode!: "assist" | "autopilot"
}
