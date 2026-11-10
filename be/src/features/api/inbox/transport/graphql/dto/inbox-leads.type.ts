import { Field, ObjectType } from "@nestjs/graphql"
import { InboxAgentOptionType } from "./inbox-agent-option.type"
import { InboxCountsType } from "./inbox-counts.type"
import { InboxFiguresType } from "./inbox-figures.type"
import { InboxLeadRowType } from "./inbox-lead-row.type"

@ObjectType()
/** The lead list: the rows of the tab, the counts of every tab, the figures and the agents. */
export class InboxLeadsType {
    /** The customers of the tab, in the asked order. */
    @Field(() => [InboxLeadRowType])
    leads!: ReadonlyArray<InboxLeadRowType>

    /** How many customers each tab holds. */
    @Field(() => InboxCountsType)
    counts!: InboxCountsType

    /** The figures of the strip. */
    @Field(() => InboxFiguresType)
    figures!: InboxFiguresType

    /** The agents of the workspace. */
    @Field(() => [InboxAgentOptionType])
    agents!: ReadonlyArray<InboxAgentOptionType>
}
