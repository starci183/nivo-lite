"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { memberCommandSchema } from "./team.mapper"
import { runMemberCommand } from "./write-member-change"

/** Removes a member from the workspace (their account and past work stay); never one's own account. */
export const writeRemoveMember = async (input: unknown): Promise<DbOutcome<true>> => {
    const parsed = memberCommandSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "member-input")
    return runMemberCommand(parsed.data, {
        forbidSelf: true,
        change: (pair) => ({ kind: "member.removed", patch: null, summary: pair.target.displayName }),
    })
}
