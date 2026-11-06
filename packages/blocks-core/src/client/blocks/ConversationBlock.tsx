import { Children, useState } from "react"
import type { ReactNode } from "react"
import { Cluster, Heading, IconButton, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import type { conversationBlock } from "../../blocks/conversation.block"
import { conversationLayoutOf } from "../../rows/conversation-layout"
import { ConversationPane } from "../composites/ConversationPane"
import { ConversationPick } from "../composites/ConversationPick"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The pane beside the thread that tells who the thread is with: its name, a way to close it, and the block bound to the contact read. */
interface ContactPaneProps {
    readonly label: string
    readonly closeLabel: string
    readonly onClose: () => void
    readonly children: ReactNode
}

/** The contact pane: a head with its name and a close control, then the contact block. */
const ContactPane = (props: ContactPaneProps): ReactNode => (
    <>
        <PaneSection align="center">
            <Cluster gap="row" wrap={false} justify="between" align="center">
                <Heading level={2}>{props.label}</Heading>
                <IconButton intent="dismiss" label={props.closeLabel} onPress={props.onClose} />
            </Cluster>
        </PaneSection>
        <PaneSection scroll={{ label: props.label }}>{props.children}</PaneSection>
    </>
)

/**
 * The conversation in three panes: the list of threads (the first child), the open thread with its composer and proposed reply
 * (this block's own slots), and the contact of the thread (the second child), which the head of the thread shows or hides. The
 * pane is keyed by the thread, so a draft and the sends in flight stay with the thread they were written in. On a phone one pane
 * stands at a time: the list until a thread is chosen, then the thread.
 */
export const ConversationBlock = (props: RenderOf<typeof conversationBlock>): ReactNode => {
    const words = useBlockWords()
    const [list = null, contact = null] = Children.toArray(props.children)
    const [isContactOpen, setIsContactOpen] = useState(true)
    const threadId = props.params.value(props.props.selectParam)
    const hasContact = contact !== null && threadId !== null
    const layout = conversationLayoutOf({
        hasList: list !== null,
        hasThread: threadId !== null,
        hasContact: hasContact && isContactOpen,
    })
    const contactLabel = words(props.props.contactLabel ?? { key: "conversationContact" })
    return (
        <PaneGrid
            label={words(props.props.label)}
            areas={{ base: layout.base.areas, medium: layout.medium.areas, wide: layout.wide.areas }}
            columns={{ base: layout.base.columns, medium: layout.medium.columns, wide: layout.wide.columns }}
        >
            {list === null ? null : (
                <Pane area="list">
                    <PaneSection align="center">
                        <Heading level={2}>{words(props.props.listLabel ?? props.props.label)}</Heading>
                    </PaneSection>
                    <PaneSection grow>{list}</PaneSection>
                </Pane>
            )}
            <Pane area="thread">
                {threadId === null ? (
                    <ConversationPick message={words(props.props.pick)} />
                ) : (
                    <ConversationPane
                        key={threadId}
                        threadId={threadId}
                        props={props.props}
                        slots={props.slots}
                        contact={
                            contact === null
                                ? null
                                : {
                                      label: contactLabel,
                                      isOpen: isContactOpen,
                                      onToggle: () => setIsContactOpen((open) => !open),
                                  }
                        }
                    />
                )}
            </Pane>
            {hasContact && isContactOpen ? (
                <Pane area="contact">
                    <ContactPane
                        label={contactLabel}
                        closeLabel={words({ key: "conversationContactClose" })}
                        onClose={() => setIsContactOpen(false)}
                    >
                        {contact}
                    </ContactPane>
                </Pane>
            ) : null}
        </PaneGrid>
    )
}
