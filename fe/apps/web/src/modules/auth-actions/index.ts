import {
    endSession,
    requestPasswordReset,
    resendConfirmation,
    signInWithPassword,
    signUp,
    startOAuth,
    updatePassword,
} from "./actions"
import type { PasswordReset, SignInInput, SignInResult, SignUpResult } from "./actions"

import type { GraphQLResponse } from "../types"

export { confirmEmail, endSession } from "./actions"
export type { PasswordReset, SignInInput, SignInResult, SignUpResult } from "./actions"

type AuthActionsOfResult = {
    endSession: () => Promise<GraphQLResponse<true>>
    requestPasswordReset: (input: unknown) => Promise<GraphQLResponse<true>>
    resendConfirmation: (input: unknown) => Promise<GraphQLResponse<true>>
    signInWithPassword: (input: SignInInput) => Promise<GraphQLResponse<SignInResult>>
    signUp: (input: unknown) => Promise<GraphQLResponse<SignUpResult>>
    startOAuth: (next: string | undefined) => Promise<
        GraphQLResponse<{
            readonly url: string
        }>
    >
    updatePassword: (input: PasswordReset) => Promise<GraphQLResponse<true>>
}

/** The browser Auth actions (back end auth doors only: sign-in, sign-up, password, sign-out), for the auth forms and the account menus. */
export const authActionsOf = (): AuthActionsOfResult => ({
    endSession,
    requestPasswordReset,
    resendConfirmation,
    signInWithPassword,
    signUp,
    startOAuth,
    updatePassword,
})
