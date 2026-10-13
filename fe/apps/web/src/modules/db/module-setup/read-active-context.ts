import "server-only"

import type { ContextVersion } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toVersion } from "./module-setup.mapper"

/** Reads one applied context version by id: the version an installation runs on. */
export const readActiveContext = async (versionId: string): Promise<DbOutcome<ContextVersion>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.from("module_context_versions").select("*").eq("id", versionId).maybeSingle())
    return result.kind === "ok" ? dbOk(toVersion(result.value)) : result
}
