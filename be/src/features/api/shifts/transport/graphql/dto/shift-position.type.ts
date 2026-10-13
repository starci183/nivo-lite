import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A role in the shop that coverage is counted for. */
export class ShiftPositionType {
    /** The position id. */
    @Field(() => ID)
    id!: string

    /** The position name. */
    @Field(() => String)
    name!: string

    /** The colour the grid draws the position in, as a CSS colour. */
    @Field(() => String)
    color!: string
}
