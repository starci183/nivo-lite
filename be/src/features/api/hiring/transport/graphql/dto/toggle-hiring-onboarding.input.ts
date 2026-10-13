import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that tick or untick an onboarding item. */
export class ToggleHiringOnboardingInput {
    /** The item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** Whether it is done. */
    @Field(() => Boolean)
    @IsBoolean()
    done!: boolean
}
