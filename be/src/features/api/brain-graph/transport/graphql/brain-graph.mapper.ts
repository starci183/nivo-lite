import type { BrainGraph } from "@modules/domain/brain"
import type { BrainChangeDecision } from "@modules/domain/brain/brain-change-messages.service"
import type { FactRelation } from "@modules/domain/brain-facts"
import type { DecideBrainChangeRequest } from "../../application/decide-brain-change.contracts"
import type { GetBrainGraphRequest } from "../../application/get-brain-graph.contracts"
import type { LinkBrainFactsRequest } from "../../application/link-brain-facts.contracts"
import type { UnlinkBrainFactsRequest } from "../../application/unlink-brain-facts.contracts"
import type { BrainGraphInput } from "./dto/brain-graph.input"
import type { BrainChangeDecisionType } from "./dto/brain-change-decision.type"
import type { BrainGraphEdgeType } from "./dto/brain-graph-edge.type"
import type { BrainGraphType } from "./dto/brain-graph.type"
import type { DecideBrainChangeInput } from "./dto/decide-brain-change.input"
import type { LinkBrainFactsInput } from "./dto/link-brain-facts.input"
import type { UnlinkBrainFactsInput } from "./dto/unlink-brain-facts.input"

/** Maps the GraphQL input to the request. */
export const toGetBrainGraphRequest = (workspaceId: string, input: BrainGraphInput | undefined): GetBrainGraphRequest => ({
    workspaceId,
    subjectKey: input?.subjectKey,
    query: input?.query,
    cursor: input?.cursor,
    limit: input?.limit,
})

/** Maps the GraphQL input to the request. */
export const toLinkBrainFactsRequest = (workspaceId: string, input: LinkBrainFactsInput): LinkBrainFactsRequest => ({
    workspaceId,
    fromFactId: input.fromFactId,
    toFactId: input.toFactId,
    kind: input.kind,
    label: input.label,
})

/** Maps the GraphQL input to the request. */
export const toUnlinkBrainFactsRequest = (workspaceId: string, input: UnlinkBrainFactsInput): UnlinkBrainFactsRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps an edge to the GraphQL type. */
export const toBrainGraphEdgeType = (edge: FactRelation): BrainGraphEdgeType => edge

/** Maps the answer to the GraphQL type. */
export const toBrainGraphType = (graph: BrainGraph): BrainGraphType => graph

/** Maps the GraphQL input to the request. */
export const toDecideBrainChangeRequest = (workspaceId: string, input: DecideBrainChangeInput): DecideBrainChangeRequest => ({
    workspaceId,
    changeId: input.changeId,
    action: input.action,
    note: input.note,
})

/** Maps the decision to the GraphQL type. */
export const toBrainChangeDecisionType = (decision: BrainChangeDecision): BrainChangeDecisionType => decision
