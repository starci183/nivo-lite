import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** SavedContentRows returned by content settings operations. */
export class SavedContentRowsType {
    /** count. */
    @Field(() => Int)
    count!: number
}
