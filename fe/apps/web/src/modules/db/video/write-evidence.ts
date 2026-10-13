import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../../supabase/types/database.types"

/** One evidence line of the video module. */
export interface VideoEvidence {
    /** Event kind, for example video.render_queued. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** One line in the reader language. */
    readonly summary: string
    /** Optional detail. */
    readonly evidence?: string
}

/** Appends an evidence line; a failure to log never fails the action it describes. */
export const writeEvidence = async (
    client: SupabaseClient<Database>,
    workspaceId: string,
    line: VideoEvidence,
): Promise<void> => {
    await client.from("events").insert({
        workspace_id: workspaceId,
        kind: line.kind,
        actor: line.actor,
        summary: line.summary,
        evidence: line.evidence ?? null,
    })
}
