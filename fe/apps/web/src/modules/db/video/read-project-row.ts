import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { PROJECT_COLUMNS } from "./video.mapper"
import type { ProjectRow } from "./video.mapper"

/** Reads one project row of a workspace under RLS, as stored. */
export const readProjectRow = async (
    client: SupabaseClient<Database>,
    workspaceId: string,
    id: string,
): Promise<DbOutcome<ProjectRow>> =>
    toOutcome(
        await client
            .from("video_projects")
            .select(PROJECT_COLUMNS)
            .eq("workspace_id", workspaceId)
            .eq("id", id)
            .maybeSingle(),
    )
