import { createHash } from "node:crypto"
import { builder } from "@starci/jest-preset"
import type { MemberListing, WorkspaceMember } from "@modules/domain/workspace-members"

/** Stored invitation data for the isolated service proofs. */
interface InviteFixture {
    id: string
    workspace_id: string
    email: string
    role: "staff" | "manager" | "owner"
    staff_id: string | null
    accepted_at: string | null
    revoked_at: string | null
    expires_at: string
}

/** Shared L2 service proof fixture. */
export const NOW = "2026-10-12T00:00:00.000Z"
/** Shared L2 service proof fixture. */
export const TOKEN = createHash("sha256").update("fixture-workspace-invite-token").digest("hex")
/** Shared L2 service proof fixture. */
export const LINK = `https://app.test/invite/${TOKEN}`
/** Shared L2 service proof fixture. */
export const REDIRECT = `https://app.test/auth/confirm?next=${encodeURIComponent("/invite/" + TOKEN)}`
/** Shared L2 service proof fixture. */
export const EXPIRES = new Date("2026-10-19T00:00:00.000Z")

/** Shared L2 service proof fixture. */
export const actorOf = builder<WorkspaceMember>({
    userId: "owner-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Chu",
    status: "active",
})
/** Shared L2 service proof fixture. */
export const listingOf = builder<MemberListing>({
    ...actorOf(),
    email: "chu@example.test",
    lastSignInAt: null,
})
/** Shared L2 service proof fixture. */
export const accountOf = () => ({
    id: "user-2",
    email: "an@example.test",
    lastSignInAt: null,
    avatarUrl: null,
    displayName: "An",
})

/** Shared L2 service proof fixture. */
export const inviteRowOf = builder<InviteFixture>({
    id: "invite-1",
    workspace_id: "ws-1",
    email: "An@Example.test",
    role: "staff",
    staff_id: null,
    accepted_at: null,
    revoked_at: null,
    expires_at: "2026-10-19T00:00:00.000Z",
})

/** A pending stored invitation returned by the list query. */
export const pendingInviteRow = {
    id: "invite-1",
    email: "an@example.test",
    role: "manager",
    staff_id: "staff-1",
    created_at: "2026-10-10T00:00:00.000Z",
    expires_at: "2026-10-17T00:00:00.000Z",
}

/** The corresponding public listing. */
export const pendingInviteExpected = [
    {
        id: "invite-1",
        email: "an@example.test",
        role: "manager",
        staffId: "staff-1",
        createdAt: "2026-10-10T00:00:00.000Z",
        expiresAt: "2026-10-17T00:00:00.000Z",
    },
]

/** The public preview of a revoked invitation. */
export const revokedInvitePreview = {
    workspace_name: "Shop",
    email: "a@example.test",
    role: "staff",
    staff_name: null,
    state: "revoked",
}
