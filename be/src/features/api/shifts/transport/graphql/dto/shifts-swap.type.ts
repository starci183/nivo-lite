import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ShiftsWorkItemType } from "./shifts-work-item.type"

@ObjectType()
/** One swap or claim request. */
export class ShiftsSwapType {
    /** The request id. */
    @Field(() => ID)
    id!: string

    /** swap or claim. */
    @Field(() => String)
    kind!: string

    /** The shift. */
    @Field(() => ID)
    shiftId!: string

    /** Who offers the shift; null for a claim. */
    @Field(() => ID, { nullable: true })
    fromStaffId!: string | null

    /** Who takes the shift. */
    @Field(() => ID)
    toStaffId!: string

    /** The reason. */
    @Field(() => String)
    reason!: string

    /** pending, approved or declined. */
    @Field(() => String)
    status!: string

    /** The rule findings at decision time. */
    @Field(() => [String])
    checks!: ReadonlyArray<string>

    /** The decision it waits on. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** When it was filed. */
    @Field(() => String)
    createdAt!: string

    /** The decision, when there is one. */
    @Field(() => ShiftsWorkItemType, { nullable: true })
    item!: ShiftsWorkItemType | null

    /** One line describing the shift. */
    @Field(() => String)
    shiftLine!: string
}
