import type { FactForm } from "@modules/domain/brain"

/** What save fact takes. */
export interface SaveFactRequest extends FactForm {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
}
