"use server"
import "server-only"

import { DEFAULT_VOICE, MUSIC_TRACKS, TTS_VOICES, colorOf, guardBrand, inWorkspaceFolder } from "@/modules/video"
import type { Brand } from "@/modules/video"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readBrand } from "./read-brand"
import { readManagerScope } from "./read-scope"

/** The longest shop name the brand kit keeps. */
const SHOP_NAME_MAX = 60

/** Saves the brand kit of the workspace (owners and managers) and returns it as stored. A colour that is not "#rrggbb" keeps the stored one. */
export const saveVideoBrand = async (input: unknown): Promise<DbOutcome<Brand>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    const brand = guardBrand(input)
    if (brand === null) return dbFailure("invalid", "brand-input")
    const workspaceId = scope.value.workspaceId
    const logo = brand.logoPath !== null && inWorkspaceFolder(brand.logoPath, workspaceId) ? brand.logoPath : null
    const primary = colorOf(brand.primary)
    const secondary = colorOf(brand.secondary)
    const client = await createServerDbClient()
    const saved = toOutcome(
        await client
            .from("video_brand_kits")
            .upsert(
                {
                    workspace_id: workspaceId,
                    shop_name: brand.shopName.trim().slice(0, SHOP_NAME_MAX),
                    ...(primary === null ? {} : { primary_color: primary }),
                    ...(secondary === null ? {} : { secondary_color: secondary }),
                    logo_path: logo,
                    music_track: MUSIC_TRACKS.find((entry) => entry.id === brand.musicTrack)?.id ?? null,
                    voice: TTS_VOICES.find((entry) => entry === brand.voice) ?? DEFAULT_VOICE,
                    updated_by: scope.value.userId,
                },
                { onConflict: "workspace_id" },
            )
            .select("workspace_id")
            .single(),
    )
    if (saved.kind !== "ok") return saved
    return readBrand(workspaceId)
}
