import type { ChatbotSidePanelView } from "@/modules/types"
import {
    Avatar,
    Button,
    Cluster,
    DescriptionList,
    Heading,
    IconButton,
    PaneSection,
    Stack,
    Text,
    Section,
} from "@starci/grammar/common"
import { ChatbotEscalationForm } from "@/components/branches/ChatbotEscalationForm"
import { ChatbotStageSteps } from "@/components/branches/ChatbotStageSteps"
import { nivoIconSource } from "@/components/leaves/Icon"
import { UNTIL_DOCKED_CLASS_NAME } from "./classNames"
/** The customer pane: who the customer is, the waiting question, who replies and the lead. */
interface ChatbotSidePanelProps extends ChatbotSidePanelView {
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
                <Cluster gap="row" wrap={false} justify="end">
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
                <Cluster gap="row" wrap={false}>
                    <Stack gap="identity" measure="full">
                        <Heading level={2}>{props.title}</Heading>
                    </Stack>
                    <div className={UNTIL_DOCKED_CLASS_NAME}>{closeButton}</div>
                </Cluster>
            </PaneSection>
            <PaneSection>
                <Cluster gap="row" wrap={false}>
                    <Avatar name={props.customerName} size="lg" isDecorative />
                    <Stack gap="identity" measure="full">
                        <Text isStrong overflow="truncate">
                            {props.customerName}
                        </Text>
                        <Text size="sm" tone="muted">
                            {props.channelLine}
                        </Text>
                    </Stack>
                </Cluster>
            </PaneSection>
            {escalation === null ? null : (
                <PaneSection>
                    <ChatbotEscalationForm
                        {...escalation}
                        onDraft={props.onEscalationDraft}
                        onSendAnswer={props.onSendAnswer}
                        onDeclineAnswer={props.onDeclineAnswer}
                    />
                </PaneSection>
            )}
            {renderChatbotSidePanelHandling(handling, props)}
            {props.stage === null ? null : (
                <PaneSection>
                    <ChatbotStageSteps {...props.stage} />
                </PaneSection>
            )}
            {renderChatbotSidePanelLead(props)}
        </>
    )
}
/** Renders the ChatbotSidePanel lead section: the person this chat became, or that there is none yet. */
const renderChatbotSidePanelLead = (props: Pick<ChatbotSidePanelProps, "leadTitle" | "leadNone" | "lead">) => (
    <PaneSection>
        <Section title={props.leadTitle}>
            <Stack gap="row">
                {props.lead === null ? (
                    <Text size="sm" tone="muted">
                        {props.leadNone}
                    </Text>
                ) : (
                    <>
                        <Text>{props.lead.name}</Text>
                        <DescriptionList layout="columns" items={props.lead.facts} />
                        <Cluster gap="inline">
                            <Button intent="neutral" size="sm" href={props.lead.openHref}>
                                {props.lead.openLabel}
                            </Button>
                        </Cluster>
                    </>
                )}
            </Stack>
        </Section>
    </PaneSection>
)
/** Renders the ChatbotSidePanel handling section. */
const renderChatbotSidePanelHandling = (
    handling: NonNullable<ChatbotSidePanelProps["handling"]>,
    props: ChatbotSidePanelProps,
) => (
    <PaneSection>
        <Section title={handling.title}>
            <Stack gap="row">
                <Text size="sm">{handling.text}</Text>
                <Cluster gap="inline">
                    <Button
                        intent="neutral"
                        isPending={handling.isBusy}
                        isDisabled={handling.isBusy}
                        onPress={props.onToggleHandling}
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
        </Section>
    </PaneSection>
)
