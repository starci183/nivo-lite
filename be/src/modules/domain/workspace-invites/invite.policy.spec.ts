import { builder } from "@starci/jest-preset"
import { WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { isEmailAddress, judgeInvite, normaliseEmail } from "./invite.policy"
import type { InviteState } from "./workspace-invites.contracts"

const inviteOf = builder<InviteState>({
    id: "invite-1",
    workspaceId: "ws-1",
    email: "An@Example.test",
    role: "staff",
    staffId: null,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: "2026-10-20T00:00:00.000Z",
})

const now = new Date("2026-10-12T00:00:00.000Z")

describe("normaliseEmail", () => {
    it("trims and lower-cases", () => {
        expect(normaliseEmail("  An@Example.TEST ")).toBe("an@example.test")
    })
})

describe("isEmailAddress", () => {
    it.each([
        ["an@example.test", true],
        ["an@example", false],
        ["an example@x.test", false],
        ["", false],
    ] as const)("answers %s as %s", (email, expected) => {
        expect(isEmailAddress(email)).toBe(expected)
    })
})

describe("judgeInvite", () => {
    it("accepts a pending invitation for the address that signed in, whatever its case", () => {
        const invite = inviteOf()
        expect(judgeInvite(invite, " an@example.TEST", now)).toSucceedWith(invite)
    })

    it("refuses a token that matches no invitation", () => {
        expect(judgeInvite(undefined, "an@example.test", now)).toBeRefused(WorkspaceInvitesErrorCode.Invalid)
    })

    it("refuses a revoked invitation before any other check", () => {
        const invite = inviteOf({ revokedAt: "2026-10-11T00:00:00.000Z", acceptedAt: "2026-10-11T00:00:00.000Z" })
        expect(judgeInvite(invite, "other@example.test", now)).toBeRefused(WorkspaceInvitesErrorCode.Revoked)
    })

    it("refuses an invitation that was already used", () => {
        const invite = inviteOf({ acceptedAt: "2026-10-11T00:00:00.000Z" })
        expect(judgeInvite(invite, "an@example.test", now)).toBeRefused(WorkspaceInvitesErrorCode.Used)
    })

    it("refuses an expired invitation", () => {
        const invite = inviteOf({ expiresAt: "2026-10-11T00:00:00.000Z" })
        expect(judgeInvite(invite, "an@example.test", now)).toBeRefused(WorkspaceInvitesErrorCode.Expired)
    })

    it("refuses a different signed-in address", () => {
        expect(judgeInvite(inviteOf(), "other@example.test", now)).toBeRefused(WorkspaceInvitesErrorCode.EmailMismatch)
    })
})
