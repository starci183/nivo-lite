import { Field, ObjectType } from "@nestjs/graphql"
import { LocalizedTextType } from "./localized-text.type"

@ObjectType()
/** A template worth proposing right after a module is installed. */
export class AutomationSuggestionType {
    /** The template key. */
    @Field()
    key!: string

    /** The name. */
    @Field(() => LocalizedTextType)
    name!: LocalizedTextType

    /** Why. */
    @Field(() => LocalizedTextType)
    reason!: LocalizedTextType
}
