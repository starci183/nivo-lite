import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The closed pipeline cards beyond the board limit. */
export class SalesClosedHiddenType {
    /** The won. */
    @Field(() => Int)
    won!: number

    /** The lost. */
    @Field(() => Int)
    lost!: number
}
