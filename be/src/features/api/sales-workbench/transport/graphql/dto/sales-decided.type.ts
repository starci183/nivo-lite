import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** One recent human Sales decision. */
export class SalesDecidedType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The work item id. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The lead id. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The lead name. */
    @Field(() => String, { nullable: true })
    leadName!: string | null

    /** The department. */
    @Field(() => String)
    department!: string

    /** The action. */
    @Field(() => String)
    action!: string

    /** The decided by. */
    @Field(() => String)
    decidedBy!: string

    /** The decider kind. */
    @Field(() => String)
    deciderKind!: string

    /** The outcome. */
    @Field(() => String)
    outcome!: string

    /** The reason. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The note. */
    @Field(() => String, { nullable: true })
    note!: string | null

    /** The created at. */
    @Field(() => String)
    createdAt!: string
}
