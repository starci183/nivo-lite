import { Field, Int, ObjectType } from "@nestjs/graphql"
import { OfficeRoomMemberPreviewType } from "./office-room-member-preview.type"

@ObjectType()
/** The total membership and at most four avatar previews of a Hub room. */
export class OfficeRoomMembersType {
    /** The number of members in the room. */
    @Field(() => Int)
    count!: number

    /** The first four members, in stable joining order. */
    @Field(() => [OfficeRoomMemberPreviewType])
    preview!: ReadonlyArray<OfficeRoomMemberPreviewType>
}
