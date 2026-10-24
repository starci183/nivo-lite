import { Field, ObjectType } from "@nestjs/graphql"
import type { PageInfo } from "@modules/platform/pagination"

@ObjectType("SalesOrderPageInfo")
/** The sales order transport's representation of the shared continuation contract. */
export class SalesOrderPageInfoType implements PageInfo {
    /** The opaque position of the last returned order, or null for an empty page. */
    @Field(() => String, { nullable: true })
    endCursor!: string | null

    /** Whether another order follows this page. */
    @Field(() => Boolean)
    hasNextPage!: boolean
}
