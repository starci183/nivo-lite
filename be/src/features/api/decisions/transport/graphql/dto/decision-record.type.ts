import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the decision log. */
export class DecisionRecordType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The work item the decision was about. */
    @Field(() => ID, { nullable: true })
    work_item_id?: string | null

    /** The customer it was about. */
    @Field(() => ID, { nullable: true })
    lead_id?: string | null

    /** The customer name, when there is one. */
    @Field(() => String, { nullable: true })
    leadName?: string | null

    /** The module. */
    @Field()
    department!: string

    /** The action key. */
    @Field()
    action!: string

    /** Who decided, by display name. */
    @Field()
    decided_by!: string

    /** `policy`, `owner` or `staff`. */
    @Field()
    decider_kind!: string

    /** `auto_done`, `approved`, `edited` or `rejected`. */
    @Field()
    outcome!: string

    /** Why the gate asked, when it did. */
    @Field(() => String, { nullable: true })
    reason?: string | null

    /** A note from the decider. */
    @Field()
    note!: string

    /** When it was decided, ISO 8601. */
    @Field()
    created_at!: string
}
