import "server-only"

import { cache } from "react"
import type { Installation } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { INSTALLATION_COLUMNS, toInstallation } from "./modules.mapper"

const INSTALLATIONS_LIMIT = 200

/** Reads every installed agent (instance) of a workspace, oldest first, under the row level security of the signed-in member. */
export const readInstallations = cache(async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<Installation>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("module_installations")
            .select(INSTALLATION_COLUMNS)
            .eq("workspace_id", workspaceId)
            .order("created_at")
            .limit(INSTALLATIONS_LIMIT),
    )
    if (result.kind !== "ok") return result
    return dbOk(
        result.value.flatMap((row): ReadonlyArray<Installation> => {
            const installation = toInstallation(row)
            return installation === null ? [] : [installation]
        }),
    )
})
