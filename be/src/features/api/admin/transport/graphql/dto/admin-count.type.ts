import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A count by key. */
export class AdminCountType {
    /** The key. */
    @Field()
    key!: string

    /** The count. */
    @Field(() => Int)
    count!: number
}
