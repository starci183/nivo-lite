"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { authority } from "@/i18n/dict/authority"
import type { Outcome } from "@/lib/types"
import { SAVE_ROW_CLASS } from "./classNames"

type Saver = {
  readonly isPending: boolean
  readonly saved: boolean
  readonly error: string | null
  readonly run: (job: () => Promise<Outcome<unknown>>) => void
  readonly reset: () => void
}

/** Save state for one section: pending, inline error and a "Saved" confirmation. Refreshes the page data on success. */
export const useSaver = (): Saver => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (job: () => Promise<Outcome<unknown>>) => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const result = await job()
        if (result.ok) {
          setSaved(true)
          router.refresh()
        } else {
          setError(result.error)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }
  return { isPending, saved, error, run, reset: () => setSaved(false) }
}

/** Props for {@link SaveRow}. */
export type SaveRowProps = { readonly saver: Saver; readonly onSave: () => void; readonly label?: string; readonly variant?: "primary" | "secondary" }

/** The section footer: one primary save with pending state, a saved note and an inline error. */
export const SaveRow = ({ saver, onSave, label, variant = "primary" }: SaveRowProps) => {
  const t = useT(authority)
  return (
    <>
      {saver.error ? <Alert title={t("saveFailTitle")} description={saver.error} tone="negative" /> : null}
      <div className={SAVE_ROW_CLASS}>
        {saver.saved ? <Text live="polite" size="sm" tone="muted">{t("saved")}</Text> : null}
        <Button variant={variant} isPending={saver.isPending} onPress={onSave}>{label ?? t("saveLabel")}</Button>
      </div>
    </>
  )
}
