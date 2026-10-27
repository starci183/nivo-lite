import { ActiveWorkspaceSideEffect, AuthSideEffect } from "@/hooks/effects"

/** Draws nothing: mounts the two app-wide side effects of the signed-in session. */
export const SideEffectsLayoutBase = () => (
    <>
        <AuthSideEffect />
        <ActiveWorkspaceSideEffect />
    </>
)
