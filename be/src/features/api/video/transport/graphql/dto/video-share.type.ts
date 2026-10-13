import { ObjectType, Field } from "@nestjs/graphql"

@ObjectType()
/** Which owner channels received the download link. */
export class VideoShareType {
    /** Shared in Office. */
    @Field()
    office!: boolean

    /** Sent to Telegram. */
    @Field()
    telegram!: boolean
}
