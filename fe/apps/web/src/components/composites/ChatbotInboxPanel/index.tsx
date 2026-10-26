import type { ReactNode } from "react"
import { Alert, EmptyNotice, FillViewport, SurfaceCard } from "@starci/grammar/common"
import {
    CENTER_CLASS_NAME,
    INBOX_CLASS_NAME,
    LIST_PANE_OPEN_CLASS_NAME,
    LIST_PANE_WIDE_ONLY_CLASS_NAME,
    SIDE_PANE_DOCKED_ONLY_CLASS_NAME,
    SIDE_PANE_OPEN_CLASS_NAME,
    THREAD_PANE_OPEN_CLASS_NAME,
    THREAD_PANE_WIDE_ONLY_CLASS_NAME,
    WORKBENCH_CLASS_NAME,
} from "./classNames"

/** The words, panes and the three drawn parts of the inbox. */
interface ChatbotInboxPanelProps {
    readonly title: string
    readonly actionFailedTitle: string
    readonly actionError: string | null
    readonly pane: "list" | "thread"
    readonly hasSelection: boolean
    readonly pickTitle: string
    readonly pickBody: string
    readonly sideLabel: string
    readonly isInfoOpen: boolean
    /** The conversation list. */
    readonly list: ReactNode
    /** The open thread; drawn only while a conversation is selected. */
    readonly thread: ReactNode
    /** The customer pane; drawn only while a conversation is selected. */
    readonly side: ReactNode
}

/** The Chatbot inbox layout: the conversation list, the open thread and the customer pane inside one joined card. */
export const ChatbotInboxPanel = (props: ChatbotInboxPanelProps) => {
    const isListOpen = props.pane === "list"
    return (
        <div className={WORKBENCH_CLASS_NAME}>
            {props.actionError === null ? null : (
                <Alert tone="negative" title={props.actionFailedTitle} description={props.actionError} />
            )}
            <FillViewport minHeight="md" bottomInset="page">
                <SurfaceCard ariaLabel={props.title} composition="joined" height="fill">
                    <div className={INBOX_CLASS_NAME}>
                        <div className={isListOpen ? LIST_PANE_OPEN_CLASS_NAME : LIST_PANE_WIDE_ONLY_CLASS_NAME}>
                            {props.list}
                        </div>
                        <div className={isListOpen ? THREAD_PANE_WIDE_ONLY_CLASS_NAME : THREAD_PANE_OPEN_CLASS_NAME}>
                            {props.hasSelection ? (
                                props.thread
                            ) : (
                                <div className={CENTER_CLASS_NAME}>
                                    <EmptyNotice message={props.pickTitle} description={props.pickBody} />
                                </div>
                            )}
                        </div>
                        {props.hasSelection ? (
                            <aside
                                className={
                                    props.isInfoOpen ? SIDE_PANE_OPEN_CLASS_NAME : SIDE_PANE_DOCKED_ONLY_CLASS_NAME
                                }
                                aria-label={props.sideLabel}
                            >
                                <SurfaceCard ariaLabel={props.sideLabel} composition="joined" height="fill">
                                    {props.side}
                                </SurfaceCard>
                            </aside>
                        ) : null}
                    </div>
                </SurfaceCard>
            </FillViewport>
        </div>
    )
}
