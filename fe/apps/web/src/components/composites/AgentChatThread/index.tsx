import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { Link, Text } from "@starci/grammar/common"
import { NOTICE_ROW_CLASS_NAME, THREAD_CLASS_NAME } from "./classNames"

/** The scroll region of the open conversation. */
export interface AgentChatThreadProps {
    readonly label: string
    /** Changes whenever the thread should scroll to its end. */
    readonly scrollKey: string
    /** The link that follows a customer chat into the work flow of the lead, or null. */
    readonly handoff: { readonly label: string; readonly href: string } | null
    /** The line that says a human took the conversation over, or null. */
    readonly takenOverNotice: string | null
    readonly children: ReactNode
}

/** The log of one conversation: its content, the hand-off link, the takeover notice and the end it scrolls to. */
export const AgentChatThread = (props: AgentChatThreadProps) => {
    const endRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" })
    }, [props.scrollKey])
    return (
        <div className={THREAD_CLASS_NAME} role="log" aria-label={props.label}>
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
        </div>
    )
}
