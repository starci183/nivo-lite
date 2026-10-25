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

    /** The picture the team sees: the uploaded one, else the sign-in provider's (public URLs, no signing needed); null for the generated one. */
    @Field(() => String, { nullable: true })
    avatarUrl!: string | null

    /** The picture the caller uploaded, or null when there is none to remove. */
    @Field(() => String, { nullable: true })
    uploadedAvatarUrl!: string | null

    /** The identity providers linked to the account (`google`, `email`). */
    @Field(() => [String])
    providers!: Array<string>

    /** The devices signed in, the current one first. */
    @Field(() => [DeviceSessionType])
    sessions!: Array<DeviceSessionType>
}
