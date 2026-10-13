import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** LeadGenHandoff exposed to the workbench. */
export class LeadGenHandoffType {
    /** The handoff work item. */
    @Field(() => ID)
    key!: string

    /** Prospect handed to Sales. */
    @Field(() => ID)
    leadId!: string

    /** Customer name. */
    @Field(() => String)
    name!: string

    /** Latest lead score. */
    @Field(() => String, { nullable: true })
    score!: string | null

    /** Handoff instant. */
    @Field(() => String)
    at!: string

    /** Sales classification status, when created. */
    @Field(() => String, { nullable: true })
    classify!: string | null

    /** Current prospect stage. */
    @Field(() => String)
    stage!: string

    /** The prospect detail path. */
    @Field(() => String)
    href!: string
}
