import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ShiftsWorkItemType } from "./shifts-work-item.type"

@ObjectType()
/** One leave request. */
export class ShiftsLeaveType {
    /** The request id. */
    @Field(() => ID)
    id!: string

    /** The person. */
    @Field(() => ID)
    staffId!: string

    /** The first day. */
    @Field(() => String)
    from!: string

    /** The last day. */
    @Field(() => String)
    to!: string

    /** The reason. */
    @Field(() => String)
    reason!: string

    /** pending, approved or declined. */
    @Field(() => String)
    status!: string

    /** The decision it waits on. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** When it was filed. */
    @Field(() => String)
    createdAt!: string

    /** The decision, when there is one. */
    @Field(() => ShiftsWorkItemType, { nullable: true })
    item!: ShiftsWorkItemType | null
}
