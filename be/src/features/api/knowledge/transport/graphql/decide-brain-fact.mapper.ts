import type { DecideBrainFactRequest } from "../../application/decide-brain-fact.contracts"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { DecideBrainFactInput } from "./dto/decide-brain-fact.input"
import type { BrainFactType } from "./dto/brain-fact.type"
import { toBrainFactType } from "./brain-records.mapper"

/** Maps the GraphQL input to the request. */
export const toDecideBrainFactRequest = (workspaceId: string, input: DecideBrainFactInput): DecideBrainFactRequest => ({
    workspaceId,
    id: input.id,
    action: input.action,
    note: input.note,
    situation: input.situation,
})

/** Maps the answer to the GraphQL type. */
export const toDecideBrainFactType = (result: FactRecord): BrainFactType => toBrainFactType(result)
