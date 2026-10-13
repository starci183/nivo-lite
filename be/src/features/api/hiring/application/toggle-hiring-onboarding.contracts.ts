import type { ToggleOnboardingParams } from "@modules/domain/hiring"

/** What tick or untick an onboarding item takes. */
export interface ToggleHiringOnboardingRequest extends ToggleOnboardingParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
