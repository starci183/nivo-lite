import { Field, ObjectType } from "@nestjs/graphql"
import type { PageInfo } from "@modules/platform/pagination"

@ObjectType("LeadBoardPageInfo")
/** The lead board transport's representation of the shared continuation contract. */
export class LeadBoardPageInfoType implements PageInfo {
    /** The opaque position of the last returned lead, or null for an empty page. */
    @Field(() => String, { nullable: true })
    endCursor!: string | null

    /** Whether another lead follows this page. */
    @Field(() => Boolean)
    hasNextPage!: boolean
}
