import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The Page subscription. */
export class MetaPageSubscriptionType {
    /** The Page is subscribed to the app. */
    @Field(() => Boolean)
    subscribed!: boolean

    /** The fields subscribed. */
    @Field(() => [String])
    fields!: ReadonlyArray<string>

    /** Wanted fields that are missing. */
    @Field(() => [String])
    missing!: ReadonlyArray<string>
}
