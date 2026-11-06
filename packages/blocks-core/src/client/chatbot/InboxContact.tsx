import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Avatar, Badge, Cluster, DescriptionList, Heading, Link, Stack, Text } from "@starci/grammar/common"
import type { inboxBlock } from "../../blocks/chatbot/inbox.block"
import { contactOf, leadFactsOf } from "../../rows/chatbot/contact"
import type { ContactView } from "../../rows/chatbot/contact"
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

/** The facts of the customer as a lead: the stage, the need and the phone, each only when known. */
const LeadFacts = (props: { readonly contact: ContactView; readonly words: Words }): ReactNode => {
    const facts = leadFactsOf(props.contact)
    if (facts.length === 0) return <Badge tone="neutral">{props.words({ key: "inbox_lead_none" })}</Badge>
    return (
        <DescriptionList
            layout="columns"
            isDivided
            items={facts.map((fact) => ({
                id: fact.id,
                term: props.words({ key: `fact_${fact.id}` }),
                description: fact.id === "stage" ? props.words({ key: `stage_${fact.text}` }) : fact.text,
            }))}
        />
    )
}

/** The contact of the open conversation: who the customer is, who answers them, and what is known of them as a lead. */
const ContactBody = (props: ContactBodyProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const { contact } = props
    return (
        <Stack gap="region">
            <Cluster gap="inline" wrap={false} align="center">
                <Avatar name={contact.name} size="md" isDecorative />
                <Stack gap="inline">
                    <Heading level={3} isLoading={props.isLoading}>
                        {contact.name}
                    </Heading>
                    {contact.channelName === "" ? null : (
                        <Text size="sm" tone="muted">
                            {words({ key: "inbox_channel_line" }).replace("{channel}", contact.channelName)}
                        </Text>
                    )}
                </Stack>
            </Cluster>
            <Stack gap="row">
                <Heading level={3}>{words({ key: "inbox_who_answers" })}</Heading>
                <Text size="sm" tone="muted">
                    {contact.handledBy === ""
                        ? words({ key: "inbox_who_ai" })
                        : words({ key: "inbox_who_person" }).replace("{name}", contact.handledBy)}
                </Text>
            </Stack>
            <Stack gap="row">
                <Cluster gap="row" wrap={false} justify="between" align="center">
                    <Heading level={3}>{words({ key: "inbox_lead_title" })}</Heading>
                    {contact.leadId === "" ? null : (
                        <Link
                            href={host.navigation.href(`/w/sales/pipeline?lead=${encodeURIComponent(contact.leadId)}`)}
                        >
                            {words({ key: "inbox_open_lead" })}
                        </Link>
                    )}
                </Cluster>
                <LeadFacts contact={contact} words={words} />
            </Stack>
        </Stack>
    )
}

/** What the skeleton of the contact draws. */
const PLACEHOLDER: ContactView = {
    name: "........",
    channelName: "........",
    handledBy: "",
    stage: "",
    need: "",
    phone: "",
    leadId: "",
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
