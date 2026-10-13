import type { OpenApiConnectionView } from "@modules/domain/data-hub"
import type { LoadOpenApiConnectionRequest } from "../../application/load-open-api-connection.contracts"
import type { LoadOpenApiConnectionInput } from "./dto/load-open-api-connection.input"
import type { OpenApiConnectionType } from "./dto/open-api-connection.type"

/** Maps the GraphQL arguments of loadOpenApiConnection to the request. */
export const toLoadOpenApiConnectionRequest = (
    workspaceId: string,
    input: LoadOpenApiConnectionInput,
): LoadOpenApiConnectionRequest => ({ workspaceId, connectionId: input.connectionId })

/** Maps the answer of loadOpenApiConnection to the GraphQL type. */
export const toOpenApiConnectionType = (result: OpenApiConnectionView): OpenApiConnectionType => result
