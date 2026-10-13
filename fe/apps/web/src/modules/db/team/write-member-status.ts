"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { statusCommandSchema } from "./team.mapper"
import { runMemberCommand } from "./write-member-change"

/** Disables (cannot sign in to the workspace) or enables a member; never one's own account. */
export const writeMemberStatus = async (input: unknown): Promise<DbOutcome<true>> => {
    const parsed = statusCommandSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "member-input")
    return runMemberCommand(parsed.data, {
        forbidSelf: true,
        change: (pair) => ({
            kind: parsed.data.status === "disabled" ? "member.disabled" : "member.enabled",
            patch: { status: parsed.data.status },
            summary: pair.target.displayName,
        }),
    })
}
