"use client"

import { useCallback, useEffect, useState } from "react"
import { dismissKey } from "./format"

/** Remembers a dismissed promo in localStorage (safe when storage is blocked). `ready` is false until read. */
export const useDismissed = (id: string): { readonly ready: boolean; readonly dismissed: boolean; readonly dismiss: () => void } => {
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(dismissKey(id)) === "1")
    } catch {
      setDismissed(false)
    }
    setReady(true)
  }, [id])
  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      window.localStorage.setItem(dismissKey(id), "1")
    } catch {
      /* storage blocked: dismissal lasts for this view only */
    }
  }, [id])
  return { ready, dismissed, dismiss }
}
