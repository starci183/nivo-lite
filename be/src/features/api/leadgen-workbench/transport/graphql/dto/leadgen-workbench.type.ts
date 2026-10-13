import { Field, Int, ObjectType } from "@nestjs/graphql"
import { LeadGenCommentType } from "./leadgen-comment.type"
import { LeadGenHandoffType } from "./leadgen-handoff.type"
import { LeadGenLeadType } from "./leadgen-lead.type"
import { LeadGenMetricsType } from "./leadgen-metrics.type"
import { LeadGenSourceType } from "./leadgen-source.type"

@ObjectType()
/** The prospect, source, comment and handoff areas of a Lead Gen workbench. */
export class LeadGenWorkbenchType {
    /** The header figures. */
    @Field(() => LeadGenMetricsType)
    metrics!: LeadGenMetricsType
    /** The latest one hundred prospects. */
    @Field(() => [LeadGenLeadType])
    leads!: Array<LeadGenLeadType>
    /** The remaining prospects beyond the displayed limit. */
    @Field(() => Int)
    leadsHidden!: number
    /** Sources ranked by the number of prospects. */
    @Field(() => [LeadGenSourceType])
    sources!: Array<LeadGenSourceType>
    /** Public reply drafts waiting for approval. */
    @Field(() => [LeadGenCommentType])
    comments!: Array<LeadGenCommentType>
    /** Prospects handed to Sales. */
    @Field(() => [LeadGenHandoffType])
    handoffs!: Array<LeadGenHandoffType>
}
