import type { ChangePasswordRequest } from "../../application/auth.contracts"
import type { ChangePasswordInput } from "./dto/change-password.input"

/** The application request of a password change from its GraphQL input. */
export const toChangePasswordRequest = (input: ChangePasswordInput): ChangePasswordRequest => ({
    current: input.currentPassword,
    next: input.newPassword,
})
