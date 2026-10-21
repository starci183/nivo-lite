import type { Secret } from "@modules/platform/config"

/** What the MCP integration holds: the credentials remote servers accept, by NAME; values never leave this integration. */
export interface McpOptions {
    /** The bearer secrets by NAME (a connector's `credential_ref`), each read through `<NAME>_FILE`. */
    readonly credentials: ReadonlyMap<string, Secret>
}
