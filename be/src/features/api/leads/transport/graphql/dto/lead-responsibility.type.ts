import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A lead responsibility after it has been added or reassigned. */
export class LeadResponsibilityType {
    /** The responsibility id. */
    @Field(() => ID)
    id!: string

    /** The lead it belongs to. */
    @Field(() => ID)
    leadId!: string

    /** The title of the step. */
    @Field()
    title!: string

    /** `human` or `agent`. */
    @Field()
    ownerKind!: string

    /** The agent that owns it, when one does. */
    @Field(() => ID, { nullable: true })
    ownerAgentId!: string | null

    /** The name shown as owner. */
    @Field()
    ownerName!: string

    /** What happens next. */
    @Field()
    nextAction!: string

    /** The due date, ISO 8601. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null

    /** The status of the responsibility. */
    @Field()
    status!: string
}
