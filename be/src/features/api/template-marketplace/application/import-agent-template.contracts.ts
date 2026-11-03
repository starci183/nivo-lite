import type { ParameterValues } from "@nivo/agent-sdk/template"

/** What the ImportAgentTemplate operation takes. */
export interface ImportAgentTemplateRequest {
    /** The workspaceId. */
    readonly workspaceId: string
    /** The templateKey. */
    readonly templateKey: string
    /** The version. */
    readonly version: number
    /** The values. */
    readonly values: ParameterValues
    /** The name. */
    readonly name: string | null
}
