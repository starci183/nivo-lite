import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The requirements shown to applicants. */
export class PublicRequirementsType {
    /** Skills. */
    @Field(() => [String])
    skills!: ReadonlyArray<string>

    /** Years of experience. */
    @Field(() => Int, { nullable: true })
    experienceYears!: number | null

    /** Experience note. */
    @Field(() => String)
    experienceNote!: string

    /** Availability. */
    @Field(() => [String])
    availability!: ReadonlyArray<string>

    /** Must have. */
    @Field(() => [String])
    mustHave!: ReadonlyArray<string>

    /** Nice to have. */
    @Field(() => [String])
    niceToHave!: ReadonlyArray<string>
}
