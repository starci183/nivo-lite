import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ShiftSegType } from "./shift-seg.type"

@ObjectType()
/** The work of one person on the day before the week, for the rest rule. */
export class ShiftsPriorType {
    /** The person. */
    @Field(() => ID)
    staffId!: string

    /** The pieces of work. */
    @Field(() => [[ShiftSegType]])
    segs!: ReadonlyArray<ShiftSegType>
}
