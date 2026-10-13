import { Field, ObjectType } from "@nestjs/graphql"
import { OfficeMessageType } from "./office-message.type"
import { OfficeThreadCursorType } from "./office-thread-cursor.type"

@ObjectType()
/** One page of the Office thread, newest first. */
export class OfficeMessagePageType {
    /** The messages of the page. */
    @Field(() => [OfficeMessageType])
    messages!: ReadonlyArray<OfficeMessageType>

    /** The cursor of the next page; null at the end. */
    @Field(() => OfficeThreadCursorType, { nullable: true })
    next?: OfficeThreadCursorType | null
}
