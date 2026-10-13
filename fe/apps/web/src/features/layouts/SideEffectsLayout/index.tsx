import { ActiveWorkspaceSideEffect, AuthSideEffect } from "@/hooks/effects"

/** The app-wide side effects of the signed-in session: follows the Supabase session and restores the active workspace. Renders nothing. */
export const SideEffectsLayout = () => (
    <>
        <AuthSideEffect />
        <ActiveWorkspaceSideEffect />
    </>
)
