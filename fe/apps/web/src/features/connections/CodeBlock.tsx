"use client"

import { useState } from "react"
import { Button, FencedCodeBlock } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"

/** A copy-ready code block (curl, JSON, a snippet) with a small copy button. Grammar's FencedCodeBlock owns the frame, inset and overflow. */
export const CodeBlock = ({ label, code }: { readonly label?: string; readonly code: string }) => {
  const t = useT(connectionWizard)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // The text stays selectable on screen.
    }
  }
  return (
    <FencedCodeBlock
      code={code}
      label={label}
      action={<Button variant="outline" size="sm" onPress={copy}>{copied ? t("copied") : t("copy")}</Button>}
    />
  )
}
