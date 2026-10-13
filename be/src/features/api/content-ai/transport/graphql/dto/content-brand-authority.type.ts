import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Authority voice and limits that constrain public content. */
export class ContentBrandAuthorityType {
    /** The owner's brand voice. */
    @Field()
    brandVoice!: string

    /** The preferred reply style. */
    @Field()
    replyStyle!: string

    /** Prohibited claims and other business limits. */
    @Field()
    limitsNote!: string
}
