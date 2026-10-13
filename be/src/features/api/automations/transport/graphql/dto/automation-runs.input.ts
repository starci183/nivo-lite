import { Field, InputType } from "@nestjs/graphql"
import { Matches, MaxLength } from "class-validator"

@InputType()
/** The run history: one template, or every template when empty. */
export class AutomationRunsInput {
    /** The template key; empty for every template. */
    @Field(() => String, { defaultValue: "" })
    @Matches(/^([a-z][a-z0-9_-]{2,60})?$/u)
    @MaxLength(61)
    template = ""
}
