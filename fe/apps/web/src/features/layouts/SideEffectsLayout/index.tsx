import { AuthSideEffect } from "@/hooks/effects"
import { SideEffectsLayoutBase } from "./component"

/** The app-wide side effects of the signed-in session: follows the browser session. Renders nothing. */
export const SideEffectsLayout = () => (
    <SideEffectsLayoutBase>
        <AuthSideEffect />
    </SideEffectsLayoutBase>
)
