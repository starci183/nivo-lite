import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One automated check of the review. */
export class ListingCheckType {
    /** The check. */
    @Field(() => String)
    id!: string

    /** True when it passed. */
    @Field(() => Boolean)
    ok!: boolean

    /** What it found. */
    @Field(() => String)
    detail!: string
}
