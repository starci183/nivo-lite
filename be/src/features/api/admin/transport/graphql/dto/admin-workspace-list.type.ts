import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AdminWorkspaceCountsType } from "./admin-workspace-counts.type"
import { AdminWorkspaceItemType } from "./admin-workspace-item.type"

@ObjectType()
/** The filtered workspace list with the size of every filter. */
export class AdminWorkspaceListType {
    /** The total. */
    @Field(() => Int)
    total!: number

    /** The counts. */
    @Field(() => AdminWorkspaceCountsType)
    counts!: AdminWorkspaceCountsType

    /** The items. */
    @Field(() => [AdminWorkspaceItemType])
    items!: Array<AdminWorkspaceItemType>
}
