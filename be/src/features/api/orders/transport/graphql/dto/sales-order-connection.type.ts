import { Field, ObjectType } from "@nestjs/graphql"
import { SalesOrderPageInfoType } from "./sales-order-page-info.type"
import { SalesOrderType } from "./sales-order.type"

@ObjectType()
/** A page of workspace sales orders and the cursor for the next page. */
export class SalesOrderConnectionType {
    /** The orders in stable newest-first order. */
    @Field(() => [SalesOrderType])
    nodes!: ReadonlyArray<SalesOrderType>

    /** Whether another page exists and where it begins. */
    @Field(() => SalesOrderPageInfoType)
    pageInfo!: SalesOrderPageInfoType
}
