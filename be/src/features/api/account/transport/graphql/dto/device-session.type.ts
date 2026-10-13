import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One signed-in device of the account. */
export class DeviceSessionType {
    /** The Auth session id. */
    @Field(() => ID)
    id!: string

    /** The raw user agent the device signed in with. */
    @Field(() => String, { nullable: true })
    userAgent!: string | null

    /** The address the session came from. */
    @Field(() => String, { nullable: true })
    ip!: string | null

    /** When the session was created, ISO 8601. */
    @Field(() => String, { nullable: true })
    createdAt!: string | null

    /** When it was last active, ISO 8601. */
    @Field(() => String, { nullable: true })
    lastActiveAt!: string | null

    /** True for the session the request runs on. */
    @Field()
    isCurrent!: boolean
}
