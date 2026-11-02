import { Alert, Button, Cluster, Quote, Stack, Text, Textarea, Section } from "@starci/grammar/common"

/** The waiting question the AI handed to a person, with the draft answer and how the last attempt went. */
interface ChatbotEscalationFormProps {
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
    readonly onDraft: (draft: string) => void
    readonly onSendAnswer: () => void
    readonly onDeclineAnswer: () => void
}

/** The recessed band of the customer pane where a person answers a question the AI could not. */
export const ChatbotEscalationForm = (props: ChatbotEscalationFormProps) => (
    <Section title={props.title}>
        <Stack gap="row">
            <Stack gap="identity">
                <Quote source={props.askedLabel} text={props.question} />
                {props.assigned === null ? null : (
                    <Text size="xs" tone="muted">
                        {props.assigned}
                    </Text>
                )}
            </Stack>
            <Textarea
                label={props.draftLabel}
                description={props.draftHint}
                rows={4}
                isDisabled={props.isAnswering}
                value={props.draft}
                onValueChange={props.onDraft}
            />
            {props.noticeTone === null ? null : (
                <Alert tone={props.noticeTone} title={props.noticeTitle} description={props.noticeText ?? undefined} />
            )}
            <Cluster gap="inline">
                <Button
                    intent="commit"
                    isPending={props.isAnswering}
                    isDisabled={props.isAnswering || props.draft.trim().length === 0}
                    onPress={props.onSendAnswer}
                >
                    {props.sendLabel}
                </Button>
                <Button intent="alternative" isDisabled={props.isAnswering} onPress={props.onDeclineAnswer}>
                    {props.declineLabel}
                </Button>
            </Cluster>
        </Stack>
    </Section>
)
