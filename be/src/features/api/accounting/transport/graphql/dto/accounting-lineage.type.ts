import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Lineage returned by GraphQL. */
export class AccountingLineageType {
    /** kind. */
    @Field(() => String)
    kind!: string

    /** title. */
    @Field(() => String)
    title!: string

    /** detail. */
    @Field(() => String, { nullable: true })
    detail!: string | null

    /** at. */
    @Field(() => String, { nullable: true })
    at!: string | null

    /** status. */
    @Field(() => String, { nullable: true })
    status!: string | null

    /** amount. */
    @Field(() => Float, { nullable: true })
    amount!: number | null
}
