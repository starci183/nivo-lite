import type { SetSepayEnvironmentRequest } from "../../application/set-sepay-environment.contracts"
import type { SetSepayEnvironmentInput } from "./dto/set-sepay-environment.input"

/** Maps the GraphQL arguments of setSepayEnvironment to the request. */
export const toSetSepayEnvironmentRequest = (
    workspaceId: string,
    input: SetSepayEnvironmentInput,
): SetSepayEnvironmentRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    environment: input.environment,
})
