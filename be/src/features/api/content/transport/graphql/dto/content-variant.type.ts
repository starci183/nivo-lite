import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The draft text for one social channel. */
export class ContentVariantType {
    /** The social channel of this version. */
    @Field()
    channel!: string

    /** The draft text. */
    @Field()
    text!: string

    /** The channel-specific hashtags. */
    @Field(() => [String])
    hashtags!: Array<string>

    /** The channel-specific editing note. */
    @Field()
    note!: string
}
