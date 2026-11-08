import { Children, useState, type ReactNode } from "react"
import { Cluster, Heading, IconButton, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { inboxBlock } from "../../blocks/chatbot/inbox.block"
import { conversationLayoutOf } from "../../rows/chatbot/conversation-layout"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"
import { ConversationPane } from "./ConversationPane"
import { ConversationPick } from "./ConversationPick"
import { InboxContact } from "./InboxContact"
import { InboxList } from "./InboxList"

/** What the contact pane is given: the block's own props and how to close the pane. */
interface ContactPaneProps extends RenderOf<typeof inboxBlock> {
    /** Closes the pane. */
    readonly onClose: () => void
}

/** The contact pane: a head with its name and a close control, then the contact of the customer. */
const ContactPane = (props: ContactPaneProps): ReactNode => {
    const words = useBlockWords()
    return (
        <>
            <PaneSection align="center">
                <Cluster gap="row" wrap={false} justify="between" align="center">
                    <Heading level={2}>{words({ key: "customer_label" })}</Heading>
                    <IconButton
                        intent="dismiss"
                        label={words({ key: "inbox_contact_close" })}
                        onPress={props.onClose}
                    />
                </Cluster>
            </PaneSection>
            <PaneSection scroll={{ label: words({ key: "customer_label" }) }}>
                <InboxContact {...props} />
            </PaneSection>
        </>
    )
}

/**
 * The Chatbot inbox in three panes: the list of conversations, the open conversation with its composer and, under its lines, the
 * approval card the spec placed as the block's child, and the contact of the customer, which the head of the thread shows or hides.
 * The thread pane is keyed by the conversation, so a draft and the sends in flight stay with the conversation they were written in.
 * On a phone one pane stands at a time: the list until a conversation is chosen, then the conversation.
 */
export const InboxBlock = (props: RenderOf<typeof inboxBlock>): ReactNode => {
    const words = useBlockWords()
    const [isContactOpen, setIsContactOpen] = useState(true)
    const [approval = null] = Children.toArray(props.children)
    const threadId = props.params.value(props.props.selectParam)
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
            <Pane area="list">
                <PaneSection align="center">
                    <Heading level={2}>{words({ key: "list_label" })}</Heading>
                </PaneSection>
                <PaneSection grow>
                    <InboxList {...props} />
                </PaneSection>
            </Pane>
            <Pane area="thread">
                {threadId === null ? (
                    <ConversationPick message={words({ key: "thread_pick" })} />
                ) : (
                    <ConversationPane
                        key={threadId}
                        threadId={threadId}
                        slots={props.slots}
                        approval={approval}
                        contact={{
                            label: words({ key: "customer_label" }),
                            isOpen: isContactOpen,
                            onToggle: () => setIsContactOpen((open) => !open),
                        }}
                    />
                )}
            </Pane>
            {threadId !== null && isContactOpen ? (
                <Pane area="contact">
                    <ContactPane {...props} onClose={() => setIsContactOpen(false)} />
                </Pane>
            ) : null}
        </PaneGrid>
    )
}
