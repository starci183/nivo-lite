import type { ReactNode } from "react"
import { Alert, Stack } from "@starci/grammar/common"

/** One notice that came again and again, folded into one row. */
interface ChatNoticeGroupProps {
    /** The notice as the first of them said it: what is bold, then what follows it muted. */
    readonly title: string
    readonly detail: string
    /** How many times it came, and from when to when. */
    readonly count: number
    readonly span: string
    /** The words of the control that opens the repeats and the one that folds them again. */
    readonly openLabel: string
    readonly closeLabel: string
    /** Whether the repeats are drawn under the row, and the way to toggle them. */
    readonly isOpen: boolean
    readonly onToggle: () => void
    /** The repeats themselves, drawn while the row is open. */
    readonly repeats: ReactNode
}

/**
 * Identical notices of one sender that stand one after another in a thread (an agent that asks the same thing five times) are one row:
 * the notice, the count with the first and last time, and the control that unfolds them.
 */
export const ChatNoticeGroup = (props: ChatNoticeGroupProps) => {
    const tail = `\u00d7${props.count} \u00b7 ${props.span}`
    return (
        <Stack gap="inline">
            <Alert
                tone="cautionary"
                title={props.title}
                description={props.detail === "" ? tail : `${props.detail} \u00b7 ${tail}`}
                action={{
                    label: props.isOpen ? props.closeLabel : props.openLabel,
                    kind: "row",
                    onAction: props.onToggle,
                }}
            />
            {props.isOpen ? props.repeats : null}
        </Stack>
    )
}
