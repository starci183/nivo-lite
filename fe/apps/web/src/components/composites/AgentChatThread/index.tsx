import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { Link, Text } from "@starci/grammar/common"
import { NOTICE_ROW_CLASS_NAME } from "./classNames"

/** What the open conversation says besides its messages. */
export interface AgentChatThreadProps {
    /** Changes whenever the thread should scroll to its end. */
    readonly scrollKey: string
    /** The link that follows a customer chat into the work flow of the lead, or null. */
    readonly handoff: { readonly label: string; readonly href: string } | null
    /** The line that says a human took the conversation over, or null. */
    readonly takenOverNotice: string | null
    readonly children: ReactNode
}

/**
 * The content of one conversation, to stand in the pane band that is its log: its messages, the hand-off link, the takeover
 * notice and the end the band scrolls to. The band owns the scroll, the label and the inset.
 */
export const AgentChatThread = (props: AgentChatThreadProps) => {
    const endRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" })
    }, [props.scrollKey])
    return (
        <>
            {props.children}
            {props.handoff === null ? null : (
                <div className={NOTICE_ROW_CLASS_NAME} data-testid="handoff-notice">
                    <Text size="xs" tone="muted">
                        <Link href={props.handoff.href}>{props.handoff.label}</Link>
                    </Text>
                </div>
            )}
            {props.takenOverNotice === null ? null : (
                <div className={NOTICE_ROW_CLASS_NAME} data-testid="takeover-notice">
                    <Text size="xs" tone="muted">
                        {props.takenOverNotice}
                    </Text>
                </div>
            )}
            <div ref={endRef} />
        </>
    )
}
