import "server-only"

import type { Installation } from "@/modules/installations"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { INSTALLATION_COLUMNS, toInstallation } from "./modules.mapper"

/** Reads one installation by id under the row level security of the signed-in member. */
export const readInstallation = async (installationId: string): Promise<DbOutcome<Installation>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client.from("module_installations").select(INSTALLATION_COLUMNS).eq("id", installationId).maybeSingle(),
    )
    if (result.kind !== "ok") return result
    const installation = toInstallation(result.value)
    return installation === null ? dbFailure("not-found", "module") : dbOk(installation)
}
