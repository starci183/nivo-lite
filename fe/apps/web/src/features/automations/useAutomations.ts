"use client"

import { useCallback, useState } from "react"
import type { AutomationCardView, AutomationRunView, ShopContext } from "@/lib/automation-shared"
import type { Outcome } from "@/lib/types"
import { refreshAutomations } from "@/lib/automation-actions"

export type AutomationsData = { readonly cards: ReadonlyArray<AutomationCardView>; readonly runs: ReadonlyArray<AutomationRunView>; readonly shop: ShopContext }

/** The screen's local copy of the data: every action returns the changed card, which replaces its old self (no full reload). */
export const useAutomations = (initial: AutomationsData) => {
  const [cards, setCards] = useState<ReadonlyArray<AutomationCardView>>(initial.cards)
  const [runs, setRuns] = useState<ReadonlyArray<AutomationRunView>>(initial.runs)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Run an action that returns the updated card; true when it worked. */
  const apply = useCallback(async (key: string, action: () => Promise<Outcome<AutomationCardView>>): Promise<boolean> => {
    setBusyKey(key)
    setError(null)
    const r = await action()
    setBusyKey(null)
    if (!r.ok) {
      setError(r.error)
      return false
    }
    setCards((prev) => prev.map((c) => (c.key === key ? r.data : c)))
    // A switch or a save can create runs soon after; refresh the history quietly.
    void refreshAutomations().then((all) => { if (all.ok) setRuns(all.data.runs) })
    return true
  }, [])

  return { cards, runs, shop: initial.shop, busyKey, error, setError, apply }
}
