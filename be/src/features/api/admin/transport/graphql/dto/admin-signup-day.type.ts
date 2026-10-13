import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Sign-ups on one day. */
export class AdminSignupDayType {
    /** The day. */
    @Field()
    day!: string

    /** The signups. */
    @Field(() => Int)
    signups!: number
}
