"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { ConnectionCodeBlockBase } from "./component"

/** What the surface that shows the snippet hands the block. */
type ConnectionCodeBlockProps = {
    readonly code: string
    readonly label?: string
}

/** A copy-ready code block (curl, JSON, a snippet) with a small copy button that says Copied once it has copied. */
export const ConnectionCodeBlock = (props: ConnectionCodeBlockProps) => {
    const t = useTranslations("connections")
    const [copied, setCopied] = useState(false)
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(props.code)
            setCopied(true)
        } catch {
            setCopied(false)
        }
    }
    return (
        <ConnectionCodeBlockBase
            props={{
                code: props.code,
                ...(props.label === undefined ? {} : { label: props.label }),
                actionLabel: copied ? t("copied") : t("copy"),
            }}
            on={{ copy: () => void copy() }}
        />
    )
}
