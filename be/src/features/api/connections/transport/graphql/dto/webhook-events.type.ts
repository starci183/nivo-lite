import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The events a webhook connection receives. */
export class WebhookEventsType {
    /** The picked events. */
    @Field(() => [String])
    events!: ReadonlyArray<string>
}
