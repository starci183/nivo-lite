import { Field, ObjectType } from "@nestjs/graphql"
import type { PageInfo } from "@modules/platform/pagination"

@ObjectType("WorkThreadPageInfo")
/** The work thread transport's representation of the shared continuation contract. */
export class WorkThreadPageInfoType implements PageInfo {
    /** The opaque position of the last returned thread, or null for an empty page. */
    @Field(() => String, { nullable: true })
    endCursor!: string | null

    /** Whether another thread follows this page. */
    @Field(() => Boolean)
    hasNextPage!: boolean
}
