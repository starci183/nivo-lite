"use client"

import { Button } from "@starci/grammar/common"
import { useEffect, useState } from "react"

/** The text to copy and the two words the button wears. */
interface CopyTextButtonProps {
    readonly text: string
    readonly copyLabel: string
    readonly copiedLabel: string
}

/** How long the button confirms a copy. */
const CONFIRM_MS = 2000

/** Ghost button that copies the text and confirms it in place. */
export const CopyTextButton = (props: CopyTextButtonProps) => {
    const [isCopied, setIsCopied] = useState(false)
    useEffect(() => {
        if (!isCopied) return
        const timer = window.setTimeout(() => setIsCopied(false), CONFIRM_MS)
        return () => window.clearTimeout(timer)
    }, [isCopied])
    const onCopy = () => {
        navigator.clipboard
            .writeText(props.text)
            .then(() => setIsCopied(true))
            .catch(() => setIsCopied(false))
    }
    return (
        <Button intent="neutral" size="sm" onPress={onCopy}>
            {isCopied ? props.copiedLabel : props.copyLabel}
        </Button>
    )
}
