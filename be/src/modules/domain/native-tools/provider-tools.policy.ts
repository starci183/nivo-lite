import type { NativeToolSpec } from "@modules/domain/mcp-gateway"
import {
    PROVIDER_EVENTS_INPUT_SCHEMA,
    PROVIDER_EVENTS_SCHEMA,
    PROVIDER_STATUS_INPUT_SCHEMA,
    PROVIDER_STATUS_SCHEMA,
} from "./provider-tools.schema"

/**
 * The tools every provider connector has: `status`, and `events` when the provider is a channel. Both are for internal use only and
 * both answer masked facts: the events carry the customer's id masked, which the audit masks again.
 */
export const providerTools = (label: string, channel: boolean): ReadonlyArray<NativeToolSpec> => [
    {
        name: "status",
        description: `Whether ${label} is connected for the business and whether a connection needs the owner's attention.`,
        scope: "read",
        defaultMode: "auto",
        inputSchema: PROVIDER_STATUS_INPUT_SCHEMA,
        argumentSchema: PROVIDER_STATUS_SCHEMA,
        internalOnly: true,
    },
    ...(channel
        ? [
              {
                  name: "events",
                  description: `The latest messages of one ${label} connection: when, which way, whether delivered, and the customer masked. Never the text.`,
                  scope: "read" as const,
                  defaultMode: "auto" as const,
                  inputSchema: PROVIDER_EVENTS_INPUT_SCHEMA,
                  argumentSchema: PROVIDER_EVENTS_SCHEMA,
                  secretFields: ["customerMasked"],
                  internalOnly: true,
              },
          ]
        : []),
]
