import type { ReactNode } from "react"
import { Alert, EmptyNotice, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"

/** The words, panes and the three drawn parts of the inbox. */
interface ChatbotInboxPanelProps {
    readonly title: string
    readonly actionFailedTitle: string
    readonly actionError: string | null
    /** Which pane a phone shows: the list or the open thread. */
    readonly pane: "list" | "thread"
    readonly hasSelection: boolean
    readonly pickTitle: string
    readonly pickBody: string
    readonly sideLabel: string
    readonly closeSideLabel: string
    readonly isInfoOpen: boolean
    readonly onInfoOpenChange: (isOpen: boolean) => void
    /** The conversation list. */
    readonly list: ReactNode
    /** The open thread; drawn only while a conversation is selected. */
    readonly thread: ReactNode
    /** The customer pane; drawn only while a conversation is selected. */
    readonly side: ReactNode
    /** The inbox is not read yet: no pick-a-conversation notice is drawn in the thread pane. */
    readonly isSkeleton?: boolean
}

/**
 * The Chatbot inbox as one PaneGrid in the flush pane of the instance frame: the conversation list on the surface, the open thread
 * beside it and the customer pane as a third column from the wide breakpoint, a drawer below it. A phone shows the list or the thread.
 */
export const ChatbotInboxPanel = (props: ChatbotInboxPanelProps) => (
    <PaneGrid
        label={props.title}
        areas={{
            base: [props.pane === "list" ? "list" : "thread"],
            medium: ["list thread"],
            wide: ["list thread side"],
        }}
        columns={{ base: ["fill"], medium: ["standard", "fill"], wide: ["standard", "fill", "wide"] }}
    >
        <Pane area="list" surface>
            {props.list}
        </Pane>
        <Pane area="thread">
            {props.actionError === null ? null : (
                <PaneSection>
                    <Alert tone="negative" title={props.actionFailedTitle} description={props.actionError} />
                </PaneSection>
            )}
            {props.hasSelection ? (
                props.thread
            ) : (
                <PaneSection align="center" grow>
                    {props.isSkeleton === true ? null : (
                        <EmptyNotice message={props.pickTitle} description={props.pickBody} />
                    )}
                </PaneSection>
            )}
        </Pane>
        {props.hasSelection ? (
            <Pane
                area="side"
                surface
                scroll
                label={props.sideLabel}
                collapse="drawer"
                collapseLabel={props.sideLabel}
                openLabel={props.sideLabel}
                closeLabel={props.closeSideLabel}
                isOpen={props.isInfoOpen}
                onOpenChange={props.onInfoOpenChange}
            >
                {props.side}
            </Pane>
        ) : null}
    </PaneGrid>
)
