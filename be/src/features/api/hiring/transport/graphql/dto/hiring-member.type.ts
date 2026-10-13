import { Field, ID, ObjectType } from "@nestjs/graphql"
import { HiringWindowType } from "./hiring-window.type"

@ObjectType()
/** One member who can interview, with their free windows. */
export class HiringMemberType {
    /** The member's user id. */
    @Field(() => ID)
    userId!: string

    /** The member's name. */
    @Field(() => String)
    name!: string

    /** The member's role. */
    @Field(() => String)
    role!: string

    /** The free windows. */
    @Field(() => [HiringWindowType])
    windows!: ReadonlyArray<HiringWindowType>
}
