import "server-only"

import { cache } from "react"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

/** One api_keys row as a workspace manager may read it: the column grant leaves the key hash out. */
type ApiKeysRow = Pick<
    Database["public"]["Tables"]["api_keys"]["Row"],
    "id" | "name" | "key_prefix" | "created_at" | "last_used_at" | "revoked_at"
>

/** Reads a bounded page of the API keys of a workspace the current RLS principal manages, newest first. */
export const readApiKeys = cache(async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<ApiKeysRow>>> => {
    const client = await createServerDbClient()
    return toOutcome(
        await client
            .from("api_keys")
            .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(100),
    )
})
