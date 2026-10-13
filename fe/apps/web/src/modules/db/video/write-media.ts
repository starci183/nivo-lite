"use server"
import "server-only"

import { MEDIA_BUCKET, MEDIA_MAX_BYTES, MEDIA_MIME, asciiFold, guardFile } from "@/modules/video"
import type { MediaFileInfo, UploadTicket } from "@/modules/video"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readManagerScope } from "./read-scope"

/** The ascii, URL-safe form of a file name: lower case stem and a short extension. */
const safeName = (name: string): string => {
    const dot = name.lastIndexOf(".")
    const ext =
        dot > 0
            ? name
                  .slice(dot + 1)
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "")
                  .slice(0, 5)
            : ""
    const stem = asciiFold(dot > 0 ? name.slice(0, dot) : name)
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
    const base = stem === "" ? "file" : stem
    return ext === "" ? base : `${base}.${ext}`
}

const problemOf = (file: MediaFileInfo): string | null => {
    if (file.size <= 0) return "file-empty"
    if (file.size > MEDIA_MAX_BYTES) return "file-too-large"
    return MEDIA_MIME.some((mime) => mime === file.type) ? null : "file-type"
}

/** Issues a one-shot upload ticket so the browser can send one file straight to the workspace media folder. */
export const writeMediaTicket = async (input: unknown): Promise<DbOutcome<UploadTicket>> => {
    const scope = await readManagerScope()
    if (scope.kind !== "ok") return scope
    const file = guardFile(input)
    if (file === null) return dbFailure("invalid", "file-input")
    const problem = problemOf(file)
    if (problem !== null) return dbFailure("invalid", problem)
    const path = `${scope.value.workspaceId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const client = await createServerDbClient()
    const ticket = toOutcome(await client.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path))
    return ticket.kind === "ok" ? dbOk({ path, token: ticket.value.token }) : ticket
}
