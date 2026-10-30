import type { NamedBusinessType } from "@modules/domain/workspaces"

/** What create workspace takes. */
export interface CreateWorkspaceRequest {
    /** The name of the new workspace. */
    readonly name: string
    /** The business type named at onboarding; absent or none leaves it unset. */
    readonly businessType?: NamedBusinessType | undefined
}
