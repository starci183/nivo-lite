import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One object of the app-level webhook subscription. */
export class MetaAppObjectType {
    /** The callback url Meta has. */
    @Field(() => String)
    callbackUrl!: string

    /** The fields subscribed. */
    @Field(() => [String])
    fields!: ReadonlyArray<string>

    /** Wanted fields that are missing. */
    @Field(() => [String])
    missing!: ReadonlyArray<string>

    /** Whether the callback url is the one this deployment serves. */
    @Field(() => Boolean)
    urlMatches!: boolean
}
