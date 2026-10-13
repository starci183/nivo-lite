import "server-only"

import type { Brand } from "@/modules/video"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { brandOf } from "./video.mapper"

/** Reads the brand kit of a workspace; the shop name falls back to the workspace name until the owner saves one. */
export const readBrand = async (workspaceId: string): Promise<DbOutcome<Brand>> => {
    const client = await createServerDbClient()
    const [kit, workspace] = await Promise.all([
        client.from("video_brand_kits").select("*").eq("workspace_id", workspaceId).maybeSingle(),
        client.from("workspaces").select("name").eq("id", workspaceId).maybeSingle(),
    ])
    if (kit.error !== null) return dbFailure("unavailable", "brand")
    const name = workspace.data?.name.trim() ?? ""
    return dbOk(brandOf(kit.data, name))
}
