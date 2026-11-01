import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A file of a chat message, with a short-lived address. */
export class AgentChatFileType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The name value. */
    @Field()
    name!: string

    /** The content type value. */
    @Field()
    contentType!: string

    /** The url value. */
    @Field()
    url!: string
}

@ObjectType()
/** The AgentChatMessage GraphQL result. */
export class AgentChatMessageType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The role value. */
    @Field()
    role!: string

    /** The body value. */
    @Field()
    body!: string

    /** The createdAt value. */
    @Field()
    createdAt!: string

    /** The files that came with the message. */
    @Field(() => [AgentChatFileType])
    files!: Array<AgentChatFileType>
}
