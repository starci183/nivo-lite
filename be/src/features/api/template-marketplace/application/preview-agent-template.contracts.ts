import type { PackageInput } from "@modules/domain/agent-templates"

/** What the PreviewAgentTemplate operation takes. */
export interface PreviewAgentTemplateRequest {
    /** The workspace of the creator. */
    readonly workspaceId: string
    /** The version of the agent as the creator typed it. */
    readonly input: PackageInput
}
