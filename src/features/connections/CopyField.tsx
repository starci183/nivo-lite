"use client"

import { useState } from "react"
import { Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { BUTTONS_CLASS, ITEM_CLASS, VALUE_CLASS, VALUE_ROW_CLASS } from "./wizard/classNames"

/** A selectable value with a copy button (webhook URL, API key). A `secret` value is shown masked until the owner reveals it. */
export const CopyField = ({ label, value, secret = false }: { readonly label: string; readonly value: string; readonly secret?: boolean }) => {
  const t = useT(connectionWizard)
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(!secret)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // The value stays selectable on screen once revealed.
      setShown(true)
    }
  }
  return (
    <div className={ITEM_CLASS}>
      <Text size="xs" tone="muted">{label}</Text>
      <div className={VALUE_ROW_CLASS}>
        <code className={VALUE_CLASS}>{shown ? value : "••••••••••••••••••••"}</code>
        <div className={BUTTONS_CLASS}>
          {secret ? <Button variant="ghost" onPress={() => setShown((s) => !s)}>{shown ? t("hide") : t("reveal")}</Button> : null}
          <Button variant="outline" onPress={copy}>{copied ? t("copied") : t("copy")}</Button>
        </div>
      </div>
    </div>
  )
}
