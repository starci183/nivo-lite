"use client"

import { useState } from "react"
import { Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { ACTIONS_CLASS, CODE_CLASS } from "./classNames"

/** A selectable value with a copy button (webhook URL, API key). */
export const CopyField = ({ label, value }: { readonly label: string; readonly value: string }) => {
  const t = useT(connections)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // The value stays selectable on screen.
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Text size="xs" tone="muted">{label}</Text>
      <div className={ACTIONS_CLASS}>
        <code className={CODE_CLASS}>{value}</code>
        <Button variant="outline" onPress={copy}>{copied ? t("copied") : t("copy")}</Button>
      </div>
    </div>
  )
}
