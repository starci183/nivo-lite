import { Field, ObjectType, Int } from "@nestjs/graphql"
import { LeadGenMetricsType } from "./leadgen-metrics.type"
import { LeadGenLeadType } from "./leadgen-lead.type"
import { LeadGenSourceType } from "./leadgen-source.type"
import { LeadGenCommentType } from "./leadgen-comment.type"
import { LeadGenHandoffType } from "./leadgen-handoff.type"

@ObjectType()
/** LeadGenWorkbench exposed to the workbench. */
export class LeadGenWorkbenchType {
    /** Header figures. */
    @Field(() => LeadGenMetricsType)
    metrics!: LeadGenMetricsType

    /** Latest prospects. */
    @Field(() => [LeadGenLeadType])
    leads!: Array<LeadGenLeadType>

    /** Additional prospects outside the list limit. */
    @Field(() => Int)
    leadsHidden!: number

    /** Lead origins grouped by source. */
    @Field(() => [LeadGenSourceType])
    sources!: Array<LeadGenSourceType>

    /** Public replies awaiting a decision. */
    @Field(() => [LeadGenCommentType])
    comments!: Array<LeadGenCommentType>

    /** Prospects handed to Sales. */
    @Field(() => [LeadGenHandoffType])
    handoffs!: Array<LeadGenHandoffType>
}
