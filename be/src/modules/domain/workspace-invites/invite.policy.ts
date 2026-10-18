import { ok, refused, hasEmailAddressShape } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import type { InviteState } from "./workspace-invites.contracts"

/** The address the way it is stored and compared: trimmed and lower case. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase()

/** Whether the text looks like an email address. */
export const isEmailAddress = (email: string): boolean => hasEmailAddressShape(email)

/**
 * Judges an invitation for the signed-in person: it must exist, be neither revoked, used nor expired, and name the
 * address the person signed in with.
 */
export const judgeInvite = (
    invite: InviteState | undefined,
    signedInEmail: string,
    now: Date,
): Outcome<InviteState, WorkspaceInvitesErrorCode> => {
    if (invite === undefined) return refused(WorkspaceInvitesErrorCode.Invalid)
    if (invite.revokedAt !== null) return refused(WorkspaceInvitesErrorCode.Revoked)
    if (invite.acceptedAt !== null) return refused(WorkspaceInvitesErrorCode.Used)
    if (new Date(invite.expiresAt).getTime() < now.getTime()) return refused(WorkspaceInvitesErrorCode.Expired)
    if (normaliseEmail(signedInEmail) !== normaliseEmail(invite.email)) {
        return refused(WorkspaceInvitesErrorCode.EmailMismatch)
    }
    return ok(invite)
}
