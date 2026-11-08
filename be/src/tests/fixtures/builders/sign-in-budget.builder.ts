import type { MockOf } from "@starci/jest-preset"
import { AUTH_ERROR_CODES, AuthError, type SignInBudget } from "@modules/integrations/passport"

/**
 * Makes a `mock<SignInBudget>()` behave like the package's budget: `admit` refuses an address that is over its limit with the wire
 * code, and `counted` admits, runs the check and clears the address only when the check passed.
 */
export const behaveAsSignInBudget = (budget: MockOf<SignInBudget>, allowed: boolean): void => {
    if (allowed) budget.admit.mockResolvedValue(undefined)
    else budget.admit.mockRejectedValue(new AuthError(AUTH_ERROR_CODES.TooManyAttempts))
    budget.clear.mockResolvedValue(undefined)
    budget.counted.mockImplementation(async (kind, address, check) => {
        await budget.admit(kind, address)
        const result = await check()
        if (result.passed) await budget.clear(kind, address)
        return result.value
    })
}
