"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** One API key as the page shows it; never the secret. */
interface ApiKeyView {
    readonly id: string
    readonly name: string
    readonly prefix: string
    readonly createdAt: string
    readonly lastUsedAt: string | null
    readonly revokedAt: string | null
}

/** A key just created: the secret is in this answer only. */
interface CreatedApiKey {
    readonly key: string
    readonly item: ApiKeyView
}

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const NAME_MAX = 200

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

const isView = (value: unknown): value is ApiKeyView =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.prefix === "string" &&
    typeof value.createdAt === "string" &&
    isTextOrNull(value.lastUsedAt) &&
    isTextOrNull(value.revokedAt)

const isCreated = (value: unknown): value is CreatedApiKey =>
    isRecord(value) && typeof value.key === "string" && isView(value.item)

const fieldsOf = (input: unknown): Record<string, unknown> => (isRecord(input) ? input : {})

const createSchema = {
    safeParse: (input: unknown): Parsed<{ readonly workspaceId: string; readonly name: string }> => {
        const { workspaceId, name } = fieldsOf(input)
        if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) return { success: false }
        if (typeof name !== "string" || name.trim().length < 2 || name.length > NAME_MAX) return { success: false }
        return { success: true, data: { workspaceId, name } }
    },
}

const revokeSchema = {
    safeParse: (input: unknown): Parsed<{ readonly workspaceId: string; readonly keyId: string }> => {
        const { workspaceId, keyId } = fieldsOf(input)
        if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) return { success: false }
        if (typeof keyId !== "string" || !UUID.test(keyId)) return { success: false }
        return { success: true, data: { workspaceId, keyId } }
    },
}

type KeyFunction = "api_key_create" | "api_key_revoke"

/** Runs one key function as the signed-in person, keeps the answer only when `accepts` recognises its shape and refreshes the page. */
const runKeyFunction = async <T>(
    name: KeyFunction,
    args: { readonly p_workspace: string; readonly p_name?: string; readonly p_key?: string },
    accepts: (value: unknown) => value is T,
): Promise<DbOutcome<T>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const db = await createServerDbClient()
    const answered = toOutcome(
        name === "api_key_create"
            ? await db.rpc("api_key_create", { p_workspace: args.p_workspace, p_name: args.p_name ?? "" })
            : await db.rpc("api_key_revoke", { p_workspace: args.p_workspace, p_key: args.p_key ?? "" }),
    )
    if (answered.kind !== "ok") return answered
    if (!accepts(answered.value)) return dbFailure("unavailable", "api-keys-shape")
    revalidatePath("/developers")
    return dbOk(answered.value)
}

/** Creates a key for a workspace the caller manages; the secret is built and hashed in the database and answered once. */
export const writeApiKeys = async (input: unknown): Promise<DbOutcome<CreatedApiKey>> => {
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "api-keys-input")
    return runKeyFunction(
        "api_key_create",
        { p_workspace: parsed.data.workspaceId, p_name: parsed.data.name },
        isCreated,
    )
}

/** Revokes a working key of a workspace the caller manages: it stops working at once. */
export const writeApiKeyRevocation = async (input: unknown): Promise<DbOutcome<ApiKeyView>> => {
    const parsed = revokeSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "api-keys-input")
    return runKeyFunction("api_key_revoke", { p_workspace: parsed.data.workspaceId, p_key: parsed.data.keyId }, isView)
}
