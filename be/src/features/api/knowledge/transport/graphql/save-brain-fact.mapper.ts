import type { SaveBrainFactRequest } from "../../application/save-brain-fact.contracts"
import type { ProposeResult } from "@modules/domain/brain-facts"
import type { SaveBrainFactInput } from "./dto/save-brain-fact.input"
import type { SavedFactType } from "./dto/saved-fact.type"
import { toBrainFactType } from "./brain-records.mapper"

/** Maps the GraphQL input to the request. */
export const toSaveBrainFactRequest = (workspaceId: string, input: SaveBrainFactInput): SaveBrainFactRequest => ({
    workspaceId,
    subjectType: input.subjectType,
    subjectLabel: input.subjectLabel,
    attributeLabel: input.attributeLabel,
    value: input.value,
    scope: input.scope,
    modules: input.modules,
    validFrom: input.validFrom,
    validTo: input.validTo,
    note: input.note,
    gapId: input.gapId,
})

/** Maps the answer to the GraphQL type. */
export const toSaveBrainFactType = (result: ProposeResult): SavedFactType => ({
    outcome: result.outcome,
    fact: toBrainFactType(result.fact),
})
