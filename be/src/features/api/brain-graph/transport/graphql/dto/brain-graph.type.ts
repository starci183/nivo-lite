import { Field, ObjectType } from "@nestjs/graphql"
import { BrainGraphEdgeType } from "./brain-graph-edge.type"
import { BrainGraphNodeType } from "./brain-graph-node.type"
import { BrainGraphPendingType } from "./brain-graph-pending.type"
import { BrainGraphSourceType } from "./brain-graph-source.type"
import { BrainGraphTotalsType } from "./brain-graph-totals.type"

@ObjectType()
/** One page of the truth graph of the Second Brain page. */
export class BrainGraphType {
    /** The truths of the page's subjects, then the neighbours their edges reach. */
    @Field(() => [BrainGraphNodeType])
    nodes!: ReadonlyArray<BrainGraphNodeType>

    /** The edges among the nodes. */
    @Field(() => [BrainGraphEdgeType])
    edges!: ReadonlyArray<BrainGraphEdgeType>

    /** Every change request waiting for the founder. */
    @Field(() => [BrainGraphPendingType])
    pending!: ReadonlyArray<BrainGraphPendingType>

    /** The source documents. */
    @Field(() => [BrainGraphSourceType])
    sources!: ReadonlyArray<BrainGraphSourceType>

    /** Totals of the whole graph. */
    @Field(() => BrainGraphTotalsType)
    totals!: BrainGraphTotalsType

    /** The cursor of the next page of subjects, or null. */
    @Field(() => String, { nullable: true })
    nextCursor!: string | null
}
