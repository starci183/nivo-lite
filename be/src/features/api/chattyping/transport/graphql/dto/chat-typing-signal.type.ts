import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The mutation answer and the private broadcast's JSON payload have the same fields. */
export class ChatTypingSignalType {
    /** The active workspace account. */
    @Field()
    id!: string

    /** The account's current workspace display name. */
    @Field()
    name!: string

    /** A stable account-id seed for initials avatars. */
    @Field()
    avatarSeed!: string

    /** False clears immediately; true is valid only until expiresAt. */
    @Field()
    typing!: boolean

    /** ISO 8601 expiration deadline, including when a stop signal is lost. */
    @Field()
    expiresAt!: string
}
