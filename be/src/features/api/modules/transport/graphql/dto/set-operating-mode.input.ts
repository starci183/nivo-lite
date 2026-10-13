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

    /** Assist asks for everything, autopilot follows the authority rules. */
    @Field()
    @IsIn(["assist", "autopilot"])
    mode!: "assist" | "autopilot"
}
