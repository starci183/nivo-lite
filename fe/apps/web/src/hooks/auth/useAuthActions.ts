import {
    endSession,
    requestPasswordReset,
    resendConfirmation,
    signInWithPassword,
    signUp,
    startOAuth,
    updatePassword,
} from "@/modules/auth"

/** The browser Auth actions (Supabase Auth only: sign-in, sign-up, password, sign-out), for the auth forms and the account menus. */
export const useAuthActions = () => ({
    endSession,
    requestPasswordReset,
    resendConfirmation,
    signInWithPassword,
    signUp,
    startOAuth,
    updatePassword,
})
