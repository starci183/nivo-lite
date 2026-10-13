import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { AdminModuleBadgeType } from "./admin-module-badge.type"
import { AdminConnectionBadgeType } from "./admin-connection-badge.type"

@ObjectType()
/** One customer workspace as the list shows it. */
export class AdminWorkspaceItemType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field()
    name!: string

    /** The owner email. */
    @Field(() => String, { nullable: true })
    ownerEmail!: string | null

    /** The status. */
    @Field()
    status!: string

    /** The plan code. */
    @Field(() => String, { nullable: true })
    planCode!: string | null

    /** The paid until. */
    @Field(() => String, { nullable: true })
    paidUntil!: string | null

    /** The created at. */
    @Field()
    createdAt!: string

    /** The members. */
    @Field(() => Int)
    members!: number

    /** The modules. */
    @Field(() => [AdminModuleBadgeType])
    modules!: Array<AdminModuleBadgeType>

    /** The connections. */
    @Field(() => [AdminConnectionBadgeType])
    connections!: Array<AdminConnectionBadgeType>

    /** The connection warning. */
    @Field()
    connectionWarning!: boolean

    /** The last customer message at. */
    @Field(() => String, { nullable: true })
    lastCustomerMessageAt!: string | null

    /** The messages7d. */
    @Field(() => Int)
    messages7d!: number

    /** The open decisions. */
    @Field(() => Int)
    openDecisions!: number

    /** The errors24h. */
    @Field(() => Int)
    errors24h!: number

    /** The attention. */
    @Field()
    attention!: boolean

    /** The unpaid. */
    @Field()
    unpaid!: boolean

    /** The idle7d. */
    @Field()
    idle7d!: boolean
}
