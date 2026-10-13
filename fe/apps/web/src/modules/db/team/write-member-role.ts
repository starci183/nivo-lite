"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { roleCommandSchema } from "./team.mapper"
import { runMemberCommand } from "./write-member-change"

/** Changes a member's role: an owner may grant any role, a manager only manager or staff; the last active owner cannot be demoted (the database refuses). */
export const writeMemberRole = async (input: unknown): Promise<DbOutcome<true>> => {
    const parsed = roleCommandSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "member-input")
    return runMemberCommand(parsed.data, {
        forbidSelf: false,
        nextRole: parsed.data.role,
        change: (pair) =>
            pair.target.role === parsed.data.role
                ? undefined
                : {
                      kind: "member.role_changed",
                      patch: { role: parsed.data.role },
                      summary: `${pair.target.displayName}: ${pair.target.role} -> ${parsed.data.role}`,
                  },
    })
}
