import type { PackageInput } from "@modules/domain/agent-templates"

/** What the PackageAgentTemplate operation takes. */
export interface PackageAgentTemplateRequest {
    /** The workspace of the creator. */
    readonly workspaceId: string
    /** The version of the agent as the creator typed it. */
    readonly input: PackageInput
}
