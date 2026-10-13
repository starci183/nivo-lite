import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What applying a stock count answers. */
export class TakeStockType {
    /** Changes applied now. */
    @Field(() => Int)
    applied!: number

    /** Changes waiting for the owner. */
    @Field(() => Int)
    waiting!: number

    /** Items whose count matched. */
    @Field(() => Int)
    same!: number
}
