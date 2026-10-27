import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Which column fills each contract field; null when no column does. */
export class ContractImportMappingType {
    /** The customer name column. */
    @Field(() => String, { nullable: true })
    customerName!: string | null

    /** The plan column. */
    @Field(() => String, { nullable: true })
    plan!: string | null

    /** The first day column. */
    @Field(() => String, { nullable: true })
    startsOn!: string | null

    /** The last day column. */
    @Field(() => String, { nullable: true })
    endsOn!: string | null

    /** The amount column. */
    @Field(() => String, { nullable: true })
    amountVnd!: string | null

    /** The status column. */
    @Field(() => String, { nullable: true })
    status!: string | null

    /** The note column. */
    @Field(() => String, { nullable: true })
    note!: string | null
}
