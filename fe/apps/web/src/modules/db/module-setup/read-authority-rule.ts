import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** The rule in force for one action of a workspace. */
export type AuthorityRuleRow = {
    readonly mode: string
    readonly limitVnd: number | null
    readonly requiredFields: ReadonlyArray<string>
}

/** Reads the stored authority rule of an action; absent when the owner never set one. */
export const readAuthorityRule = async (workspaceId: string, action: string): Promise<DbOutcome<AuthorityRuleRow>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("authority_rules")
            .select("mode, limit_vnd, required_fields")
            .eq("workspace_id", workspaceId)
            .eq("action", action)
            .maybeSingle(),
    )
    return result.kind === "ok"
        ? dbOk({
              mode: result.value.mode,
              limitVnd: result.value.limit_vnd,
              requiredFields: result.value.required_fields,
          })
        : result
}
