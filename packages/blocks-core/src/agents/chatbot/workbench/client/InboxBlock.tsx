import { useEffect, useState, type ReactNode } from "react"
import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { inboxBlock } from "../blocks/inbox.block"
import { conversationLayoutOf } from "../rows/conversation-layout"
import { recordsView } from "../../../../shared/rows/rows"
import { textOf, valueAt } from "../../../../shared/slots/paths"
import { parsedSlot } from "../../../../shared/slots/slots"
import { useBlockWords } from "../../../../shared/client/composites/useBlockWords"
import type { RenderOf } from "../../../../shared/client/render-props"
import { ConversationPane } from "./ConversationPane"
import { ConversationPick } from "./ConversationPick"
import { InboxContact } from "./InboxContact"
import { InboxList } from "./InboxList"

/** The width from which the list stands beside the thread: below it one pane shows at a time and the list stays first. */
const SIDE_BY_SIDE = "(min-width: 48rem)"

/** The conversation the inbox opens by itself where the list stands beside the thread: the first one, so the thread and its side are never an empty pane. */
const useFirstThread = (props: RenderOf<typeof inboxBlock>, threadId: string | null): void => {
    const threads = parsedSlot(props.slots.threads.slot, recordsView)
    const firstId = "items" in threads ? textOf(valueAt(threads.items[0], "id")) : ""
    const { params } = props
    const selectParam = props.props.selectParam
    useEffect(() => {
        if (threadId !== null || firstId === "" || !window.matchMedia(SIDE_BY_SIDE).matches) return
        params.set(selectParam, firstId)
    }, [threadId, firstId, params, selectParam])
}

/**
 * The Chatbot inbox in three panes: the list of conversations, the open conversation with its composer, and the contact of the customer, which the head of the thread shows or hides.
 * The thread pane is keyed by the conversation, so a draft and the sends in flight stay with the conversation they were written in.
 * On a phone one pane stands at a time: the list until a conversation is chosen, then the conversation.
 */
export const InboxBlock = (props: RenderOf<typeof inboxBlock>): ReactNode => {
    const words = useBlockWords()
    const [isContactOpen, setIsContactOpen] = useState(true)
    const threadId = props.params.value(props.props.selectParam)
    useFirstThread(props, threadId)
    const layout = conversationLayoutOf({
        hasList: true,
        hasThread: threadId !== null,
        hasContact: threadId !== null && isContactOpen,
    })
    return (
        <PaneGrid
            label={words({ key: "tab_inbox" })}
            areas={{ base: layout.base.areas, medium: layout.medium.areas, wide: layout.wide.areas }}
            columns={{ base: layout.base.columns, medium: layout.medium.columns, wide: layout.wide.columns }}
        >
            <Pane area="list" surface label={words({ key: "list_label" })}>
                <InboxList {...props} />
            </Pane>
            <Pane area="thread" label={words({ key: "tab_inbox" })}>
                {threadId === null ? (
                    <ConversationPick message={words({ key: "thread_pick" })} />
                ) : (
                    <ConversationPane
                        key={threadId}
                        threadId={threadId}
                        slots={props.slots}
                        contact={{
                            label: words({ key: "inbox_aside_toggle" }),
                            isOpen: isContactOpen,
                            onToggle: () => setIsContactOpen((open) => !open),
                        }}
                    />
                )}
            </Pane>
            {threadId !== null && isContactOpen ? (
                <Pane
                    area="contact"
                    surface
                    label={words({ key: "inbox_aside_title" })}
                    head={{
                        title: words({ key: "inbox_aside_title" }),
                        onClose: () => setIsContactOpen(false),
                        closeLabel: words({ key: "inbox_contact_close" }),
                    }}
                >
                    <PaneSection>
                        <InboxContact {...props} />
                    </PaneSection>
                </Pane>
            ) : null}
        </PaneGrid>
    )
}
