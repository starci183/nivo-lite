import type { KeepCurrentBrainFactRequest } from "../../application/keep-current-brain-fact.contracts"
import type { KeepCurrentBrainFactInput } from "./dto/keep-current-brain-fact.input"

/** Maps the GraphQL input to the request. */
export const toKeepCurrentBrainFactRequest = (
    workspaceId: string,
    input: KeepCurrentBrainFactInput,
): KeepCurrentBrainFactRequest => ({
    workspaceId,
    subjectKey: input.subjectKey,
    attribute: input.attribute,
    installationId: input.installationId,
})
