import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The website lead wait note's data. */
export class LeadWaitType {
    /** Whether the note applies to this lead. */
    @Field()
    show!: boolean

    /** Whole hours waiting, when at least one hour is known. */
    @Field(() => Int, { nullable: true })
    hours!: number | null

    /** Whether a response was approved. */
    @Field()
    replied!: boolean
}
