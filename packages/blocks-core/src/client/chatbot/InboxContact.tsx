import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Link, Stack, Sublabel, SurfaceCard } from "@starci/grammar/common"
import type { inboxBlock } from "../../blocks/chatbot/inbox.block"
import { contactOf, type ContactView } from "../../rows/chatbot/contact"
import { derivedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** What the contact is given. */
interface ContactBodyProps {
    readonly contact: ContactView
    readonly isLoading: boolean
}

/** Resolves a text of the module in the viewer's language. */
type Words = (text: SpecText) => string

/** What the facts of the conversation are given. */
interface ChatFactsProps {
    readonly contact: ContactView
    readonly words: Words
}

/** The facts of the conversation: who the customer is and the channel. */
const ChatFacts = (props: ChatFactsProps): ReactNode => {
    const { contact, words } = props
    return (
        <SurfaceCard
            kind="list"
            layout="keyValue"
            ariaLabel={words({ key: "inbox_chat_label" })}
            items={[
                { id: "customer", title: words({ key: "inbox_fact_customer" }), value: contact.name },
                ...(contact.channelName === ""
                    ? []
                    : [
                          {
                              id: "channel",
                              title: words({ key: "inbox_fact_channel" }),
                              value: contact.channelName,
                          },
                      ]),
            ]}
            empty={null}
        />
    )
}

/** The side of the open conversation: which agent answers (and whether a person holds it), the facts of the conversation and the way to the customer's contact. */
const ContactBody = (props: ContactBodyProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const { contact } = props
    return (
        <Stack gap="region">
            <Stack gap="row">
                <Sublabel>{words({ key: "inbox_agent_label" })}</Sublabel>
                <SurfaceCard
                    kind="list"
                    ariaLabel={words({ key: "inbox_agent_label" })}
                    items={[
                        {
                            id: "agent",
                            title: words({ key: "inbox_agent_name" }),
                            description:
                                contact.handledBy === ""
                                    ? words({ key: "inbox_agent_handle" })
                                    : `${contact.handledBy}${words({ key: "inbox_who_person_suffix" })}`,
                            leading: { avatar: { name: words({ key: "inbox_agent_name" }) } },
                        },
                    ]}
                    empty={null}
                    isLoading={props.isLoading}
                />
            </Stack>
            <Stack gap="row">
                <Sublabel>{words({ key: "inbox_chat_label" })}</Sublabel>
                <ChatFacts contact={contact} words={words} />
                {contact.contactId === "" ? null : (
                    <Link
                        variant="plain"
                        href={host.navigation.href(`/contacts/${encodeURIComponent(contact.contactId)}`)}
                    >
                        {words({ key: "inbox_open_contact" })}
                    </Link>
                )}
            </Stack>
        </Stack>
    )
}

/** What the skeleton of the contact draws. */
const PLACEHOLDER: ContactView = {
    name: "........",
    channelName: "........",
    avatar: "",
    handledBy: "",
    contactId: "",
}

/** The body of the contact pane, in the states of the thread read. */
export const InboxContact = (props: RenderOf<typeof inboxBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels({ key: "inbox_contact_idle" })
    const read = props.slots.thread
    const untitled = words({ key: "inbox_untitled" })
    return (
        <SlotView
            slot={derivedSlot(read.slot, (record) => contactOf(record, untitled))}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(contact, isLoading) => <ContactBody contact={contact} isLoading={isLoading} />}
        />
    )
}
