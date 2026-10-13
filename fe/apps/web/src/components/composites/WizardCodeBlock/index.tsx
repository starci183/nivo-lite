import { useState } from "react"
import { Button, FencedCodeBlock } from "@starci/grammar/common"

/** What the copy-ready code block draws. */
type WizardCodeBlockProps = {
    readonly code: string
    readonly label: string
    readonly copyLabel: string
    readonly copiedLabel: string
}

/** A copy-ready code block (a snippet) with a small copy button that says Copied once it has copied. */
export const WizardCodeBlock = (props: WizardCodeBlockProps) => {
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
        <FencedCodeBlock
            code={props.code}
            label={props.label}
            action={
                <Button variant="outline" size="sm" onPress={() => void copy()}>
                    {copied ? props.copiedLabel : props.copyLabel}
                </Button>
            }
        />
    )
}
