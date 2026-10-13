import { Field, ObjectType } from "@nestjs/graphql"
import { DeviceSessionType } from "./device-session.type"

@ObjectType()
/** Everything the account page draws. */
export class MyAccountType {
    /** The name from the profile, else the email's local part. */
    @Field()
    name!: string

    /** The account email. */
    @Field()
    email!: string

    /** The identity providers linked to the account (`google`, `email`). */
    @Field(() => [String])
    providers!: Array<string>

    /** The devices signed in, the current one first. */
    @Field(() => [DeviceSessionType])
    sessions!: Array<DeviceSessionType>
}
