import {
    Alert,
    Badge,
    Cluster,
    DescriptionList,
    EmptyNotice,
    Quote,
    Link,
    Section,
    Stack,
    Text,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { LeadContextPane, LeadContextView, LeadPanesOn } from "@/modules/types"

/** What the context region draws and its one command. */
interface LeadContextSectionProps {
    readonly pane: LeadContextPane
    readonly on: Pick<LeadPanesOn, "contextRefresh">
}

const PLACEHOLDER: LeadContextView = {
    contact: "",
    company: "",
    channel: "",
    captured: "",
    need: "",
    hasBrief: true,
    briefLines: [],
    preparedBy: "",
    signals: [],
    hasConversation: false,
}

/** The aside's context: the facts of the customer, their own words, the AI brief with its signals, and the way to the conversation. */
export const LeadContextSection = (props: LeadContextSectionProps) => {
    const { pane, on } = props
    const l = pane.labels
    return (
        <SlotView
            slot={pane.slot}
            placeholder={PLACEHOLDER}
            labels={l.slot}
            render={(view, isLoading) => (
                <Section id="context" title={l.title} headingLevel={2} isLoading={isLoading}>
                    <Stack gap="row">
                        <DescriptionList
                            isLoading={isLoading}
                            items={[
                                { id: "contact", term: l.factContact, description: view.contact },
                                { id: "company", term: l.factCompany, description: view.company },
                                { id: "channel", term: l.factChannel, description: view.channel },
                                { id: "captured", term: l.factCaptured, description: view.captured },
                            ]}
                        />
                        <Quote source={l.quoteSource} text={view.need} isLoading={isLoading} />
                        {view.hasBrief ? (
                            <Stack gap="inline">
                                {view.briefLines.length === 0 ? null : (
                                    <Text as="p" size="xs" tone="muted">
                                        {view.preparedBy}
                                    </Text>
                                )}
                                {view.briefLines.map((line) => (
                                    <Text key={line} as="p" size="sm">
                                        {line}
                                    </Text>
                                ))}
                            </Stack>
                        ) : (
                            <EmptyNotice
                                message={l.noBriefTitle}
                                description={l.noBriefHint}
                                actionLabel={l.prepare}
                                isActionPending={pane.isPending}
                                onAction={on.contextRefresh}
                            />
                        )}
                        {view.signals.length === 0 ? null : (
                            <Cluster gap="inline">
                                {view.signals.map((signal) => (
                                    <Badge key={signal.id} tone="warning">
                                        {signal.label}
                                    </Badge>
                                ))}
                            </Cluster>
                        )}
                        {view.hasConversation ? <Link href={l.conversationHref}>{l.viewConversation}</Link> : null}
                        {pane.error === null ? null : (
                            <Alert tone="negative" title={l.errorTitle} description={pane.error} />
                        )}
                    </Stack>
                </Section>
            )}
        />
    )
}
