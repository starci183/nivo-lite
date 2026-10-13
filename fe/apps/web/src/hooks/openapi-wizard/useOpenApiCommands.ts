"use client"

import { useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateSaveOpenApiConnectionSwr } from "@/hooks/swr"
import type { MutateSaveOpenApiConnectionRequest } from "@/modules/api/graphql/mutations/mutation-save-open-api-connection"
import { queryLoadOpenApiSpec } from "@/modules/api/graphql/queries/query-load-open-api-document"
import { queryTestOpenApiOperation } from "@/modules/api/graphql/queries/query-test-open-api-operation"
import type { QueryTestOpenApiOperationRequest } from "@/modules/api/graphql/queries/query-test-open-api-operation"
import type { OpenApiTestType } from "@/modules/api"
import { OPEN_API_AUTH_TYPES, parseOpenApiOps } from "./openapi-wizard.shared"
import type { OpenApiOp } from "./openapi-wizard.shared"

/** A spec read by the back end. */
export interface OpenApiSpecView {
    readonly title: string
    readonly baseUrl: string
    readonly specUrl: string
    readonly ops: ReadonlyArray<OpenApiOp>
    readonly authType: (typeof OPEN_API_AUTH_TYPES)[number]
    readonly authName: string
}

/** The GraphQL calls of the OpenAPI wizard (the active workspace travels in the request header). */
export interface OpenApiCommands {
    /** Reads the operations of a spec from a link or pasted text; saves nothing. */
    readonly loadSpec: (specUrl: string, specText: string) => Promise<Settled<OpenApiSpecView>>
    /** Tries one GET with the typed settings; saves nothing. */
    readonly test: (request: QueryTestOpenApiOperationRequest) => Promise<Settled<OpenApiTestType>>
    /** Saves the connection and refreshes the list; answers its id. */
    readonly save: (request: MutateSaveOpenApiConnectionRequest) => Promise<Settled<string>>
}

const authTypeOf = (raw: string): OpenApiSpecView["authType"] =>
    OPEN_API_AUTH_TYPES.find((type) => type === raw) ?? "none"

/** The OpenAPI wizard's calls bound to the toast helper. */
export const useOpenApiCommands = (): OpenApiCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerSave } = useMutateSaveOpenApiConnectionSwr()
    return useMemo(
        () => ({
            loadSpec: (specUrl, specText) =>
                settle(async () => {
                    const result = await queryLoadOpenApiSpec({ request: { specUrl, specText } })
                    if (!result.data) throw new Error("loadOpenApiSpec answered no data")
                    const spec = result.data.loadOpenApiSpec
                    return {
                        title: spec.title,
                        baseUrl: spec.baseUrl,
                        specUrl: spec.specUrl,
                        ops: parseOpenApiOps(spec.ops),
                        authType: authTypeOf(spec.authHint.type),
                        authName: spec.authHint.name,
                    }
                }),
            test: (request) =>
                settle(async () => {
                    const result = await queryTestOpenApiOperation({ request })
                    if (!result.data) throw new Error("testOpenApiOperation answered no data")
                    return result.data.testOpenApiOperation
                }),
            save: async (request) => {
                const settled = await settle(() => triggerSave(request))
                if (settled.kind !== "ok") return settled
                await refresh()
                return settled
            },
        }),
        [settle, refresh, triggerSave],
    )
}
