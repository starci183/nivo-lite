"use server"
import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { readContentManager } from "./read-actor"
import { CONTENT_MEDIA_BUCKET, buildContentMediaPath, isAcceptedMedia } from "@/modules/content"

/** A file stored for a post. */
export interface StoredMedia {
    /** The object path; it goes into the media of the post. */
    readonly path: string
    /** The name the file was uploaded with. */
    readonly name: string
}

/** Stores one picture or video (field "file") in the workspace media folder, after checking its type and size. Owner or manager only. */
export const writeMediaUpload = async (input: FormData): Promise<DbOutcome<StoredMedia>> => {
    const actor = await readContentManager()
    if (actor.kind !== "ok") return actor
    const file = input.get("file")
    if (!(file instanceof File)) return dbFailure("invalid", "input")
    if (!isAcceptedMedia({ name: file.name, type: file.type, size: file.size })) {
        return dbFailure("invalid", "upload_bad")
    }
    const path = buildContentMediaPath(actor.value.workspaceId, file.name)
    const client = await createServerDbClient()
    const stored = toOutcome(
        await client.storage.from(CONTENT_MEDIA_BUCKET).upload(path, file, { contentType: file.type }),
    )
    return stored.kind === "ok" ? dbOk({ path, name: file.name }) : stored
}
