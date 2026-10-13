import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toNivoItem } from "./knowledge.mapper"
import type { NivoRow } from "./knowledge.mapper"
import type { NivoEntry } from "@/modules/types"

const NIVO_LIMIT = 500

/** Reads the base knowledge of NIVO, which every signed-in person may read, ordered by module, kind and slug. */
export const readNivoKnowledge = async (): Promise<DbOutcome<ReadonlyArray<NivoEntry>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("nivo_knowledge")
            .select("id, module, slug, title, body, kind, version, updated_at")
            .order("module")
            .order("kind")
            .order("slug")
            .limit(NIVO_LIMIT)
            .overrideTypes<Array<NivoRow>>(),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map(toNivoItem)) : rows
}
