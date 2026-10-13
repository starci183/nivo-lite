import "server-only"

import type { ContextVersion } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toVersion } from "./module-setup.mapper"

const VERSIONS_LIMIT = 100

/** Reads every applied context version of an installation, newest first. */
export const readContextVersions = async (
    installationId: string,
): Promise<DbOutcome<ReadonlyArray<ContextVersion>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("module_context_versions")
            .select("*")
            .eq("installation_id", installationId)
            .order("version", { ascending: false })
            .limit(VERSIONS_LIMIT),
    )
    return result.kind === "ok" ? dbOk(result.value.map(toVersion)) : result
}
