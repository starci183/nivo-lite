import type { NativeToolSpec } from "@modules/domain/mcp-gateway"
import { PROVIDER_STATUS_INPUT_SCHEMA, PROVIDER_STATUS_SCHEMA } from "./provider-tools.schema"

/** The tool every provider connector has: `status`, for internal use only, answering masked facts. */
export const providerTools = (label: string): ReadonlyArray<NativeToolSpec> => [
    {
        name: "status",
        description: `Whether ${label} is connected for the business and whether a connection needs the owner's attention.`,
        scope: "read",
        defaultMode: "auto",
        inputSchema: PROVIDER_STATUS_INPUT_SCHEMA,
        argumentSchema: PROVIDER_STATUS_SCHEMA,
        internalOnly: true,
    },
]
