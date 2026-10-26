import { Alert, Badge, Button, Divider, Region, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, ESCALATION_CLASS_NAME, QUESTION_CLASS_NAME } from "./classNames"

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
        <Divider semantics="presentation" />
        <div className={ESCALATION_CLASS_NAME}>
            <div className={ACTIONS_CLASS_NAME}>
                <Badge tone="warning" isDot>
                    {props.title}
                </Badge>
            </div>
            <div className={QUESTION_CLASS_NAME}>
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
            </div>
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
            <div className={ACTIONS_CLASS_NAME}>
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
            </div>
        </div>
    </Region>
)
