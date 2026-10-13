import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The opening hours of one weekday. */
export class OpeningDayType {
    /** The weekday, 0 Monday to 6 Sunday. */
    @Field(() => Int)
    weekday!: number

    /** The opening time, HH:MM. */
    @Field(() => String)
    open!: string

    /** The closing time, HH:MM. */
    @Field(() => String)
    close!: string
}
