import { Field, ObjectType } from "@nestjs/graphql"
import { WorkItemCursorType } from "./work-item-cursor.type"
import { WorkItemType } from "./work-item.type"

@ObjectType()
/** One page of work items, newest first. */
export class WorkItemPageType {
    /** The items of the page. */
    @Field(() => [WorkItemType])
    items!: ReadonlyArray<WorkItemType>

    /** The cursor of the next page; null on the last one. */
    @Field(() => WorkItemCursorType, { nullable: true })
    next?: WorkItemCursorType | null
}
