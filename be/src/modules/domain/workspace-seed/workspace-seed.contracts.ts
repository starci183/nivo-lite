import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { Secret } from "@modules/platform/config"

/** An explicitly selected account; existing credentials are never replaced. */
export interface SeedAccount {
    /** The sign-in email. */
    readonly email: string
    /** The display name. */
    readonly name: string
    /** A privately supplied initial password, required only for a missing account. */
    readonly password?: Secret
}

/** What a seed run takes. */
export interface SeedRequest {
    /** An existing workspace selector, mutually exclusive with workspaceName. */
    readonly workspaceId?: string
    /** An exact workspace name owned by the authenticated owner. */
    readonly workspaceName?: string
    /** The owner account. */
    readonly owner: SeedAccount
    /** The manager account. */
    readonly manager: SeedAccount
    /** The staff account. */
    readonly staff: SeedAccount
    /** An owner session when password authentication is not used. */
    readonly principalToken?: Secret
    /** Explicit authority to create a missing first owner using its supplied initial password. */
    readonly bootstrapOwner?: boolean
}

/** An explicit role change authenticated by a user session rather than an actor identifier. */
export interface SeedRoleRequest {
    /** The workspace whose policy governs the change. */
    readonly workspaceId: string
    /** The existing member to change. */
    readonly memberId: string
    /** The requested business role. */
    readonly role: WorkspaceRole
    /** The session Auth must authenticate before domain authorization. */
    readonly principalToken: Secret
}

/** The private command envelope accepted from the configured target runner. */
export type SeedInput =
    | { readonly action: "ensure"; readonly request: SeedRequest }
    | { readonly action: "role"; readonly request: SeedRoleRequest }

/** Public readback evidence without account passwords or session tokens. */
export interface SeedReport {
    /** The fixed process adapter protocol. */
    readonly schema: "starci/app-workspace-access@1"
    /** True after authenticated membership readback. */
    readonly ok: true
    /** The fixed CLI action that completed. */
    readonly action: "ensure" | "role" | "verify"
    /** The workspace that was seeded. */
    readonly workspaceId: string
    /** Confirms actual membership reads separately from write acknowledgement. */
    readonly publicReadback: true
    /** The separate three-role application journey remains unjudged by a CLI receipt. */
    readonly consumerVerified: false
    /** The actual authentication path used by this operation. */
    readonly authentication: "existing-session" | "password-session"
    /** A password session is locally signed out before a successful receipt; an existing session is retained. */
    readonly sessionCleanup: "not-created" | "acknowledged"
}

/** An ensured workspace with the owner Auth authenticated for it, for the steps that write as that owner. */
export interface OwnedSeed {
    /** The public receipt of the ensure. */
    readonly report: SeedReport
    /** The authenticated owner. */
    readonly ownerId: string
}
