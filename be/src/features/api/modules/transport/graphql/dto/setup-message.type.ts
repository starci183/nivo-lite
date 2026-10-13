import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the private chat between the owner and NIVO that sets an agent up. */
export class SetupMessageType {
    /** The message. */
    @Field(() => ID)
    id!: string

    /** The session it belongs to. */
    @Field(() => ID)
    setupSessionId!: string

    /** `user` or `assistant`. */
    @Field()
    role!: string

    /** The display name of the author. */
    @Field()
    author!: string

    /** The text. */
    @Field()
    body!: string

    /** When it was written, ISO 8601. */
    @Field()
    createdAt!: string
}
