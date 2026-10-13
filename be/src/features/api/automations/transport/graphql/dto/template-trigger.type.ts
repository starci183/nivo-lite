import { Field, ObjectType } from "@nestjs/graphql"
import { LocalizedTextType } from "./localized-text.type"

@ObjectType()
/** What starts a template. */
export class TemplateTriggerType {
    /** `event` or `schedule`. */
    @Field()
    kind!: string

    /** The event name or the schedule. */
    @Field()
    event!: string

    /** The plain-words line on the card. */
    @Field(() => LocalizedTextType)
    line!: LocalizedTextType
}
