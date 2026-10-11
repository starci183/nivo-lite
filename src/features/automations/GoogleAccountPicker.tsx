"use client"

import { useEffect, useState } from "react"
import { Select } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { listAutomationGoogleAccounts } from "@/lib/automation-actions"

/** Props for {@link GoogleAccountPicker}. */
export type GoogleAccountPickerProps = {
  /** The account the automation writes with now (null: the workspace's first account). */
  readonly current: string | null
  readonly isBusy: boolean
  /** Save the pick (the board runs setAutomationGoogleAccount through its own card updater). */
  readonly onPick: (connectionId: string) => void
}

/** Which Google account a Sheets automation writes with. Shown only when the workspace has two or more accounts. */
export const GoogleAccountPicker = ({ current, isBusy, onPick }: GoogleAccountPickerProps) => {
  const t = useT(dict)
  const [accounts, setAccounts] = useState<ReadonlyArray<{ id: string; email: string; status: string }>>([])

  useEffect(() => {
    let stop = false
    void listAutomationGoogleAccounts().then((r) => { if (!stop && r.ok) setAccounts(r.data) })
    return () => { stop = true }
  }, [])

  if (accounts.length < 2) return null
  const value = current && accounts.some((a) => a.id === current) ? current : (accounts[0]?.id ?? null)
  return (
    <Select
      label={t("googleAccount")}
      description={t("googleAccountHint")}
      options={accounts.map((a) => ({ id: a.id, label: a.email || t("googleAccountUnnamed"), isDisabled: a.status !== "connected" }))}
      value={value}
      isPending={isBusy}
      onValueChange={(id) => {
        if (id && id !== value) onPick(id)
      }}
    />
  )
}
