import type { OpenApiSpecLoaded } from "@modules/domain/data-hub"
import type { LoadOpenApiSpecRequest } from "../../application/load-open-api-spec.contracts"
import type { LoadOpenApiSpecInput } from "./dto/load-open-api-spec.input"
import type { OpenApiSpecType } from "./dto/open-api-spec.type"

/** Maps the GraphQL arguments of loadOpenApiSpec to the request. */
export const toLoadOpenApiSpecRequest = (workspaceId: string, input: LoadOpenApiSpecInput): LoadOpenApiSpecRequest => ({
    workspaceId,
    specUrl: input.specUrl,
    specText: input.specText,
})

/** Maps the answer of loadOpenApiSpec to the GraphQL type. */
export const toOpenApiSpecType = (result: OpenApiSpecLoaded): OpenApiSpecType => ({
    title: result.title,
    baseUrl: result.baseUrl,
    specUrl: result.specUrl,
    ops: result.ops,
    authHint: result.authHint,
})
