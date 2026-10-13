"use server"

import { revalidatePath } from "next/cache"
import { requireOwner } from "./permissions"
import { isDataProvider, runDataSync } from "./data-hub"
import { supabaseAdmin } from "./supabase/admin"
import type { Outcome } from "./types"

const ownDataConnection = async (workspaceId: string, connectionId: string) => {
    const { data } = await supabaseAdmin()
        .from("connections")
        .select("id, provider")
        .eq("id", connectionId)
        .eq("workspace_id", workspaceId)
        .maybeSingle<{ id: string; provider: string }>()
    if (!data || !isDataProvider(data.provider)) throw new Error("Không tìm thấy kết nối dữ liệu.")
    return data
}

/** "Đồng bộ ngay" (owner): one sync now, whatever the schedule says. */
export const syncNow = async (connectionId: string): Promise<Outcome<{ rows: number }>> => {
    try {
        const me = await requireOwner()
        await ownDataConnection(me.workspaceId, connectionId)
        const r = await runDataSync(connectionId, "manual")
        revalidatePath("/connections")
        return r.ok
            ? { ok: true, data: { rows: r.rows } }
            : { ok: false, error: r.error ?? "Đồng bộ không thành công." }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}

/** How often the connection syncs on its own (owner): minutes from 5 to 10080, or null for manual only. */
export const setSyncSchedule = async (connectionId: string, everyMinutes: number | null): Promise<Outcome<true>> => {
    try {
        const me = await requireOwner()
        await ownDataConnection(me.workspaceId, connectionId)
        if (everyMinutes !== null && (!Number.isInteger(everyMinutes) || everyMinutes < 5 || everyMinutes > 10080))
            return { ok: false, error: "Chu kỳ phải từ 5 phút đến 7 ngày." }
        const { error } = await supabaseAdmin()
            .from("connections")
            .update({
                sync_every_minutes: everyMinutes,
                next_sync_at: everyMinutes ? new Date().toISOString() : null,
            })
            .eq("id", connectionId)
        if (error) return { ok: false, error: error.message }
        revalidatePath("/connections")
        return { ok: true, data: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}
