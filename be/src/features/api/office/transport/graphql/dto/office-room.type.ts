import { Field, Int, ObjectType } from "@nestjs/graphql"
import { OfficeRoomMembersType } from "./office-room-members.type"
import { OfficeRoomPinType } from "./office-room-pin.type"

@ObjectType()
/** One Hub room: the general Office room (key null) or a department room. */
export class OfficeRoomType {
    /** The room key; null is the general Office room. */
    @Field(() => String, { nullable: true })
    key?: string | null

    /** The display name; empty for the Office room. */
    @Field()
    name!: string

    /** The order in the list. */
    @Field(() => Int)
    position!: number

    /** Lines the caller has not read, at most 99. */
    @Field(() => Int)
    unread!: number

    /** The newest line's text. */
    @Field(() => String, { nullable: true })
    last_body?: string | null

    /** The newest line's author. */
    @Field(() => String, { nullable: true })
    last_author?: string | null

    /** When the newest line was written, ISO 8601. */
    @Field(() => String, { nullable: true })
    last_at?: string | null

    /** The agents seated in the room. */
    @Field(() => [String])
    agent_ids!: Array<string>

    /** The agents whose lines land in the room. */
    @Field(() => [String])
    home_agent_ids!: Array<string>

    /** The people seated in the room. */
    @Field(() => [String])
    user_ids!: Array<string>

    /** The authoritative member count and at most four avatar previews. */
    @Field(() => OfficeRoomMembersType)
    members!: OfficeRoomMembersType

    /** The pinned documents. */
    @Field(() => [OfficeRoomPinType])
    pins!: Array<OfficeRoomPinType>
}
