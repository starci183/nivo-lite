import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The written requirements a candidate is compared with. */
export class HiringJobRequirementsType {
    /** Skills the job needs. */
    @Field(() => [[String]])
    skills!: ReadonlyArray<string>

    /** The years of experience asked, when any. */
    @Field(() => Int, { nullable: true })
    experienceYears!: number | null

    /** A note about the experience. */
    @Field(() => String)
    experienceNote!: string

    /** The days and hours the job needs. */
    @Field(() => [[String]])
    availability!: ReadonlyArray<string>

    /** Requirements a candidate must meet. */
    @Field(() => [[String]])
    mustHave!: ReadonlyArray<string>

    /** Requirements that count in a candidate's favour. */
    @Field(() => [[String]])
    niceToHave!: ReadonlyArray<string>
}
