import {
    endSession,
    requestPasswordReset,
    resendConfirmation,
    signInWithPassword,
    signUp,
    startOAuth,
    updatePassword,
} from "@/modules/auth"

/** The browser Auth actions (back end auth doors only: sign-in, sign-up, password, sign-out), for the auth forms and the account menus. */
export const authActionsOf = () => ({
    endSession,
    requestPasswordReset,
    resendConfirmation,
    signInWithPassword,
    signUp,
    startOAuth,
    updatePassword,
})
