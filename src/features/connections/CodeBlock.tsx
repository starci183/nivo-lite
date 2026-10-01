"use client"

import { useState } from "react"
import { Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { CODE_BLOCK_CLASS, CODE_HEAD_CLASS, CODE_PRE_CLASS } from "./codeClassNames"

/** A copy-ready code block (curl, JSON, a snippet) with a small copy button. */
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
    <div className={CODE_BLOCK_CLASS}>
      <div className={CODE_HEAD_CLASS}>
        {label ? <Text size="xs" tone="muted">{label}</Text> : <span />}
        <Button variant="outline" onPress={copy}>{copied ? t("copied") : t("copy")}</Button>
      </div>
      <pre className={CODE_PRE_CLASS}><code>{code}</code></pre>
    </div>
  )
}
