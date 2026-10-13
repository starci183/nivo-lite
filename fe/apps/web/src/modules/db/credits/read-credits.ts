import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toQuotaStatus, toUsageSummary } from "./credits.mapper"
import type { CreditPack, DailyModuleUsage, QuotaSnapshot, TopupLot, UsageSummary } from "./credits.mapper"

/** The packs on sale in display order. */
export const readCreditPacks = async (): Promise<DbOutcome<ReadonlyArray<CreditPack>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("credit_packs")
            .select("code, credits, price_vnd, sort")
            .eq("active", true)
            .order("sort")
            .limit(50),
    )
    if (result.kind !== "ok") return result
    return dbOk(
        result.value.map((pack) => ({
            code: pack.code,
            credits: Number(pack.credits),
            price_vnd: Number(pack.price_vnd),
            sort: pack.sort,
        })),
    )
}

/** The top-up lots of a workspace, newest first (RLS: owner and manager). */
export const readTopupLots = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<TopupLot>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("credit_topups")
            .select("credits, price_vnd, purchased_at, expires_at, credits_remaining")
            .eq("workspace_id", workspaceId)
            .order("purchased_at", { ascending: false })
            .limit(200),
    )
    if (result.kind !== "ok") return result
    return dbOk(
        result.value.map((lot) => ({
            credits: Number(lot.credits),
            price_vnd: Number(lot.price_vnd),
            purchased_at: lot.purchased_at,
            expires_at: lot.expires_at,
            credits_remaining: Number(lot.credits_remaining),
        })),
    )
}

/** This month's use against the allowance (security definer rpc: any active member of the workspace). */
export const readQuotaStatus = async (workspaceId: string): Promise<DbOutcome<QuotaSnapshot>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.rpc("usage_quota_status", { p_workspace: workspaceId }))
    if (result.kind !== "ok") return result
    const [row] = result.value
    return row === undefined ? dbFailure("not-found", "quota") : dbOk(toQuotaStatus(row))
}

/** The non-guide usage of a workspace from a day on, by day and module (RLS on the usage events: members). */
const readDailyModuleUsage = async (
    workspaceId: string,
    from: string,
): Promise<DbOutcome<ReadonlyArray<DailyModuleUsage>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("ai_usage_daily")
            .select("day, module, calls, prompt_tokens, completion_tokens, cost_usd")
            .eq("workspace_id", workspaceId)
            .neq("kind", "guide")
            .gte("day", from)
            .order("day")
            .limit(2000),
    )
    if (result.kind !== "ok") return result
    return dbOk(
        result.value.map((row) => ({
            day: row.day ?? from,
            module: row.module ?? "other",
            calls: Number(row.calls),
            tokens: Number(row.prompt_tokens) + Number(row.completion_tokens),
            cost_usd: Number(row.cost_usd),
        })),
    )
}

/** This month's figures for the billing card (owner and manager). */
export const readUsageSummary = async (workspaceId: string, today: string): Promise<DbOutcome<UsageSummary>> => {
    const status = await readQuotaStatus(workspaceId)
    const from = status.kind === "ok" ? status.value.periodStart : `${today.slice(0, 8)}01`
    const rows = await readDailyModuleUsage(workspaceId, from)
    if (rows.kind !== "ok") return rows
    return dbOk(toUsageSummary(status.kind === "ok" ? status.value : null, rows.value))
}

/** The model cost in USD of a workspace from a day on (the last days, for the run-out forecast). */
export const readRecentCostUsd = async (workspaceId: string, from: string): Promise<DbOutcome<number>> => {
    const rows = await readDailyModuleUsage(workspaceId, from)
    if (rows.kind !== "ok") return rows
    return dbOk(rows.value.reduce((total, row) => total + row.cost_usd, 0))
}
