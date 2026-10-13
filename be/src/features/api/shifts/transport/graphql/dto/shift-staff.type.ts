import { Field, ID, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One person who can be scheduled, with the limits the rules enforce. */
export class ShiftStaffType {
    /** The shifts profile id. */
    @Field(() => ID)
    id!: string

    /** The person's name. */
    @Field(() => String)
    name!: string

    /** The positions this person can work. */
    @Field(() => [ID])
    positionIds!: ReadonlyArray<string>

    /** Free-form skills. */
    @Field(() => [String])
    skills!: ReadonlyArray<string>

    /** The hourly wage in dong; zero when the caller may not read pay. */
    @Field(() => Float)
    wage!: number

    /** The most hours the person works in a week. */
    @Field(() => Float)
    maxWeek!: number

    /** The most hours the person works in a day. */
    @Field(() => Float)
    maxDay!: number

    /** The fewest hours of rest between two working days. */
    @Field(() => Float)
    minRest!: number

    /** The shop's staff row this profile is linked to. */
    @Field(() => ID, { nullable: true })
    staffRowId!: string | null

    /** The Telegram chat shift messages also go to. */
    @Field(() => String, { nullable: true })
    telegramChatId!: string | null

    /** The Zalo user shift messages also go to. */
    @Field(() => String, { nullable: true })
    zaloUserId!: string | null

    /** The phone number. */
    @Field(() => String, { nullable: true })
    phone!: string | null

    /** False once the person has left. */
    @Field(() => Boolean)
    active!: boolean
}
