import { Alert, Badge, Button, Cluster, Region, Stack, SurfaceCard, Text, Textarea } from "@starci/grammar/common"

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
    <Region label={props.title}>
        <Stack gap="row">
            <Cluster gap="inline">
                <Badge tone="warning" isDot>
                    {props.title}
                </Badge>
            </Cluster>
            <Stack gap="identity">
                <Text size="xs" tone="muted">
                    {props.askedLabel}
                </Text>
                <SurfaceCard ariaLabel={props.askedLabel}>
                    <Text size="sm">{props.question}</Text>
                </SurfaceCard>
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
    </Region>
)
