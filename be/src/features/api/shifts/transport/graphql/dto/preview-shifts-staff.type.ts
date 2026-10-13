import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One person the quick import text describes. */
export class PreviewShiftsStaffType {
    /** The name. */
    @Field()
    name!: string

    /** The position names, spelled as the shop spells them. */
    @Field(() => [String])
    positions!: Array<string>

    /** The hourly wage in dong. */
    @Field(() => Float)
    wage!: number

    /** The most hours a week, or null to keep the default. */
    @Field(() => Float, { nullable: true })
    maxWeek!: number | null
}
