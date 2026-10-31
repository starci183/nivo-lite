import {
    Avatar,
    Button,
    Cluster,
    DescriptionList,
    Heading,
    IconButton,
    PaneSection,
    Region,
    SectionHeader,
    Stack,
    Text,
} from "@starci/grammar/common"
import { ChatbotEscalationForm } from "@/components/branches/ChatbotEscalationForm"
import { nivoIconSource } from "@/components/leaves/Icon"
import { HEAD_TEXT_CLASS_NAME, UNTIL_DOCKED_CLASS_NAME } from "./classNames"

/** The waiting question the AI handed to a person, with the draft answer. */
interface ChatbotSideEscalation {
    readonly title: string
    readonly askedLabel: string
    readonly question: string
    readonly assigned: string | null
    readonly draftLabel: string
    readonly draftHint: string
    readonly draft: string
    readonly sendLabel: string
    readonly declineLabel: string
    readonly isAnswering: boolean
    readonly noticeTone: "negative" | "affirmative" | null
    readonly noticeTitle: string
    readonly noticeText: string | null
}

/** Who is replying and the command that changes it. */
interface ChatbotSideHandling {
    readonly title: string
    readonly text: string
    readonly buttonLabel: string
    readonly hint: string | null
    readonly isBusy: boolean
}

/** The lead behind the conversation. */
interface ChatbotSideLead {
    readonly name: string
    readonly facts: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    readonly openLabel: string
    readonly openHref: string
}

/** The customer pane: who the customer is, the waiting question, who replies and the lead. */
export interface ChatbotSidePanelProps {
    readonly title: string
    readonly closeLabel: string
    readonly hasThread: boolean
    readonly customerName: string
    readonly channelLine: string
    readonly escalation: ChatbotSideEscalation | null
    readonly handling: ChatbotSideHandling
    readonly leadTitle: string
    readonly leadNone: string
    readonly lead: ChatbotSideLead | null
    readonly onClose: () => void
    readonly onToggleHandling: () => void
    readonly onEscalationDraft: (draft: string) => void
    readonly onSendAnswer: () => void
    readonly onDeclineAnswer: () => void
}

/** The right pane of the inbox: customer, who is replying (take over / hand back), the waiting escalation and the lead. */
export const ChatbotSidePanel = (props: ChatbotSidePanelProps) => {
    const closeButton = (
        <IconButton
            intent="dismiss"
            source={nivoIconSource("close", "leading")}
            label={props.closeLabel}
            onPress={props.onClose}
        />
    )
    if (!props.hasThread) {
        return (
            <PaneSection align="center">
                <Cluster gap="row" justify="end" wrap={false}>
                    <div className={UNTIL_DOCKED_CLASS_NAME}>{closeButton}</div>
                </Cluster>
            </PaneSection>
        )
    }
    const escalation = props.escalation
    const handling = props.handling
    return (
        <>
            <PaneSection align="center">
                <Cluster gap="row" justify="between" wrap={false}>
                    <Heading level={2}>{props.title}</Heading>
                    <div className={UNTIL_DOCKED_CLASS_NAME}>{closeButton}</div>
                </Cluster>
            </PaneSection>
            <PaneSection>
                <Cluster gap="row" wrap={false}>
                    <Avatar name={props.customerName} size="lg" isDecorative />
                    <div className={HEAD_TEXT_CLASS_NAME}>
                        <Stack gap="identity">
                            <Text weight="semibold" overflow="truncate">
                                {props.customerName}
                            </Text>
                            <Text size="sm" tone="muted">
                                {props.channelLine}
                            </Text>
                        </Stack>
                    </div>
                </Cluster>
            </PaneSection>
            {escalation === null ? null : (
                <ChatbotEscalationForm
                    {...escalation}
                    onDraft={props.onEscalationDraft}
                    onSendAnswer={props.onSendAnswer}
                    onDeclineAnswer={props.onDeclineAnswer}
                />
            )}
            {renderChatbotSidePanelHandling(handling, props.onToggleHandling)}
            {renderChatbotSidePanelLead(props.leadTitle, props.leadNone, props.lead)}
        </>
    )
}

/** Renders the ChatbotSidePanel lead section. */
const renderChatbotSidePanelLead = (title: string, none: string, lead: ChatbotSidePanelProps["lead"]) => (
    <PaneSection>
        <Region label={title}>
            <Stack gap="row">
                <SectionHeader level={3} title={title} />
                {lead === null ? (
                    <Text size="sm" tone="muted">
                        {none}
                    </Text>
                ) : (
                    <>
                        <Text weight="semibold">{lead.name}</Text>
                        <DescriptionList layout="columns" items={lead.facts} />
                        <Cluster gap="inline">
                            <Button intent="neutral" size="sm" href={lead.openHref}>
                                {lead.openLabel}
                            </Button>
                        </Cluster>
                    </>
                )}
            </Stack>
        </Region>
    </PaneSection>
)

/** Renders the ChatbotSidePanel handling section. */
const renderChatbotSidePanelHandling = (
    handling: NonNullable<ChatbotSidePanelProps["handling"]>,
    onToggleHandling: ChatbotSidePanelProps["onToggleHandling"],
) => (
    <PaneSection>
        <Region label={handling.title}>
            <Stack gap="row">
                <SectionHeader level={3} title={handling.title} />
                <Text size="sm">{handling.text}</Text>
                <Cluster gap="inline">
                    <Button
                        intent="neutral"
                        isPending={handling.isBusy}
                        isDisabled={handling.isBusy}
                        onPress={onToggleHandling}
                    >
                        {handling.buttonLabel}
                    </Button>
                </Cluster>
                {handling.hint === null ? null : (
                    <Text size="xs" tone="muted">
                        {handling.hint}
                    </Text>
                )}
            </Stack>
        </Region>
    </PaneSection>
)
