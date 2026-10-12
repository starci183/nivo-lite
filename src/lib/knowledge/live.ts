"use client"

import { useEffect, useRef, useState } from "react"
import { supabaseBrowser } from "../supabase/browser"
import { LIVE_COLUMNS, sourceFromRow, type LiveRow } from "./queue"
import { IN_FLIGHT_STATUSES, isInFlight, type KnowledgeSource } from "./shared"

/**
 * Realtime filters rows through RLS with the token the socket joined with. The browser client reads its session from the cookie
 * asynchronously, so a channel opened straight away joins with the anon key and never sees a member's rows: hand the session token
 * to the socket before any channel subscribes.
 */
const authorizeRealtime = async (sb: ReturnType<typeof supabaseBrowser>): Promise<void> => {
  const { data } = await sb.auth.getSession()
  if (data.session) await sb.realtime.setAuth(data.session.access_token)
}

const byNewest = (a: KnowledgeSource, b: KnowledgeSource): number => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)

/**
 * The workspace's sources, kept in step through realtime on knowledge_sources: a new source shows at the top as it is created, a worker's status
 * and progress show as they change, a deleted one leaves. `initial` (from the server render) is the starting point and wins whenever the page
 * is re-rendered with fresh data. After the channel (re)connects the list is read again, so nothing missed while offline is lost.
 * An empty `workspaceId` (the loading view) opens no channel.
 */
export const useLiveSources = (workspaceId: string, initial: ReadonlyArray<KnowledgeSource>): ReadonlyArray<KnowledgeSource> => {
  const [rows, setRows] = useState<ReadonlyArray<KnowledgeSource>>(initial)
  useEffect(() => { setRows(initial) }, [initial])
  const connected = useRef(false)

  useEffect(() => {
    if (!workspaceId) return
    const sb = supabaseBrowser()
    connected.current = false
    const reload = async () => {
      const { data } = await sb.from("knowledge_sources").select(LIVE_COLUMNS).eq("workspace_id", workspaceId).order("created_at", { ascending: false })
      if (data) setRows((cur) => {
        const known = new Map(cur.map((s) => [s.id, s]))
        // Keep the content the server render already had for rows that did not change shape.
        return (data as unknown as Array<LiveRow>).map((r) => ({ ...sourceFromRow(r), content: known.get(r.id)?.content ?? "" }))
      })
    }
    let cancelled = false
    let channel: ReturnType<typeof sb.channel> | null = null
    void authorizeRealtime(sb).catch(() => undefined).then(() => {
      if (cancelled) return
      channel = sb.channel(`knowledge-sources-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_sources", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id
          if (id) setRows((cur) => cur.filter((s) => s.id !== id))
          return
        }
        const next = sourceFromRow(payload.new as LiveRow)
        setRows((cur) => {
          const at = cur.findIndex((s) => s.id === next.id)
          if (at < 0) return [next, ...cur].sort(byNewest)
          const merged = cur.slice()
          merged[at] = { ...next, content: (cur[at] as KnowledgeSource).content }
          return merged
        })
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return
        // The first subscribe matches the server render; later ones follow a reconnect.
        if (connected.current) void reload()
        connected.current = true
      })
    })
    return () => { cancelled = true; if (channel) void sb.removeChannel(channel) }
  }, [workspaceId])

  return rows
}

export type InFlight = { readonly id: string; readonly status: KnowledgeSource["status"]; readonly progress: number }

/**
 * Documents still being worked on, for the Second Brain notice. `seed` is what the server render saw in flight. The hook keeps every document
 * that was in flight at any time on this page, so the bar rises as they finish (a finished one counts 100) instead of falling back.
 * `settled` flips once the last one finishes: the page refreshes its facts and counts then.
 */
export const useInFlight = (workspaceId: string, seed: ReadonlyArray<InFlight>): { readonly active: number; readonly total: number; readonly percent: number; readonly settled: number } => {
  const [seen, setSeen] = useState<ReadonlyMap<string, InFlight>>(() => new Map(seed.map((s) => [s.id, s])))
  const [settled, setSettled] = useState(0)
  const hadActive = useRef(seed.length > 0)

  useEffect(() => {
    if (!workspaceId) return
    const sb = supabaseBrowser()
    const apply = (r: LiveRow) => setSeen((cur) => {
      const have = cur.get(r.id)
      const next: InFlight = { id: r.id, status: r.status, progress: r.status === "ready" ? 100 : r.progress ?? 0 }
      if (!isInFlight(r.status) && !have) return cur
      const map = new Map(cur)
      map.set(r.id, next)
      return map
    })
    const reload = async () => {
      const { data } = await sb.from("knowledge_sources").select("id, status, progress").eq("workspace_id", workspaceId)
        .in("status", IN_FLIGHT_STATUSES)
      for (const r of (data ?? []) as Array<LiveRow>) apply(r)
    }
    let cancelled = false
    let channel: ReturnType<typeof sb.channel> | null = null
    void authorizeRealtime(sb).catch(() => undefined).then(() => {
      if (cancelled) return
      channel = sb.channel(`knowledge-progress-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_sources", filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id
          if (id) setSeen((cur) => { if (!cur.has(id)) return cur; const map = new Map(cur); map.delete(id); return map })
          return
        }
        apply(payload.new as LiveRow)
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return
        // Catch up on documents queued before the channel opened (or while it was down).
        void reload()
      })
    })
    return () => { cancelled = true; if (channel) void sb.removeChannel(channel) }
  }, [workspaceId])

  const all = [...seen.values()]
  const active = all.filter((x) => isInFlight(x.status)).length
  const percent = all.length === 0 ? 0 : Math.round(all.reduce((sum, x) => sum + (isInFlight(x.status) ? x.progress : 100), 0) / all.length)

  useEffect(() => {
    if (active > 0) { hadActive.current = true; return }
    if (hadActive.current) { hadActive.current = false; setSettled((n) => n + 1); setSeen(new Map()) }
  }, [active])

  return { active, total: all.length, percent, settled }
}
