import { Field, ID, Int, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a built draft ended in. */
export class ProposeWeekType {
    /** The new draft schedule. */
    @Field(() => ID)
    scheduleId!: string

    /** The version of the week the draft is. */
    @Field(() => Int)
    version!: number

    /** The shifts in the draft. */
    @Field(() => Int)
    shifts!: number

    /** The shifts nobody could take. */
    @Field(() => Int)
    open!: number

    /** The coverage windows below their minimum. */
    @Field(() => Int)
    short!: number

    /** The estimated wage cost in dong. */
    @Field(() => Float)
    costVnd!: number
}
