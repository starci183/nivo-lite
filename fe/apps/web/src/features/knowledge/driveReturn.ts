/** Client-only helpers for the Google Drive grant round trip of the Add documents drawer (leave for Google, come back to the same page). */

const KEY = "nivo.knowledge.drive-pending.v1"

export type DriveReturn = { readonly result: "ok" | "error"; readonly reason: string | null }
export type PendingAdd = {
  readonly links: string
  readonly topic: string
  readonly tags: string
  readonly visibility: "internal" | "public"
  readonly module: string
}

let seen: DriveReturn | null | undefined

/** The ?drive=ok|error&reason=x the callback added to the URL. Read once, then removed from the address bar (the answer is cached for the page). */
export const driveReturn = (): DriveReturn | null => {
  if (seen !== undefined) return seen
  if (typeof window === "undefined") return null
  const url = new URL(window.location.href)
  const result = url.searchParams.get("drive")
  seen = result === "ok" || result === "error" ? { result, reason: url.searchParams.get("reason") } : null
  if (seen) {
    url.searchParams.delete("drive")
    url.searchParams.delete("reason")
    try { window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`) } catch { /* the address bar keeps the params: harmless */ }
  }
  return seen
}

/** The pasted links and batch settings kept across the Google round trip (sessionStorage; silently nothing when it is blocked). */
export const savePending = (p: PendingAdd): void => {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private window or blocked storage */ }
}

export const takePending = (): PendingAdd | null => {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(KEY)
    const p = JSON.parse(raw) as Partial<PendingAdd>
    if (typeof p.links !== "string") return null
    return { links: p.links, topic: String(p.topic ?? ""), tags: String(p.tags ?? ""), visibility: p.visibility === "public" ? "public" : "internal", module: String(p.module ?? "all") }
  } catch { return null }
}
