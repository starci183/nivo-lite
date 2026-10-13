import { Field, InputType } from "@nestjs/graphql"
import { Matches, MaxLength } from "class-validator"

@InputType()
/** The suggestions: the module just installed, or the workspace-wide templates when empty. */
export class AutomationSuggestionsInput {
    /** The module key; empty for the workspace-wide templates. */
    @Field(() => String, { defaultValue: "" })
    @Matches(/^([a-z][a-z0-9_]{1,40})?$/u)
    @MaxLength(41)
    module = ""
}
