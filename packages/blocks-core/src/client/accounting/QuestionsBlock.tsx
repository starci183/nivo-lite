import { useState } from "react"
import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { Badge, Button, Cluster, Divider, Heading, Stack, Text, Textarea } from "@starci/grammar/common"
import type { accountingQuestionsBlock } from "../../blocks/accounting/questions.block"
import { answerOf, questionRowsOf, questionsRecord } from "../../rules/accounting/question-rows"
import type { QuestionRow, QuestionsRecord } from "../../rules/accounting/question-rows"
import { parsedSlot, rowsSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** The questions shown while the first read is in flight. */
const PLACEHOLDER: QuestionsRecord = {
    count: null,
    rows: [{ id: "placeholder", title: "........", description: "........", askedAt: undefined }],
}

/** What the answer form of a question is given. */
interface AnswerFormProps {
    readonly row: QuestionRow
    readonly answer: ActionHandle
    readonly onDone: () => void
}

/** The answer to one question, typed in place and sent through the answer action. */
const AnswerForm = (props: AnswerFormProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | undefined>(undefined)
    const send = (): void => {
        const text = answerOf(draft)
        if (text === null) {
            setError(words({ key: "answer_empty" }))
            return
        }
        props.answer
            .run({ id: props.row.id, command: "edit", values: { answer: text } })
            .then((outcome) => {
                if (outcome.ok) props.onDone()
                else if (outcome.reason === "invalid") setError(words(outcome.fields.answer ?? { key: "answer_empty" }))
                else host.notify("danger", words(outcome.message))
            })
            .catch(() => host.notify("danger", words({ key: "slotError" })))
    }
    return (
        <Stack gap="row">
            <Textarea
                id={`answer-${props.row.id}`}
                name="answer"
                label={words({ key: "answer_field" })}
                value={draft}
                onValueChange={(value) => {
                    setDraft(value)
                    setError(undefined)
                }}
                isReadOnly={props.answer.isRunning}
                maxLength={2000}
                {...(error === undefined ? {} : { errorMessage: error })}
            />
            <Cluster gap="inline" justify="start">
                <Button intent="commit" isPending={props.answer.isRunning} onPress={send}>
                    {words({ key: "answer_submit" })}
                </Button>
                <Button intent="neutral" onPress={props.onDone}>
                    {words({ key: "answer_cancel" })}
                </Button>
            </Cluster>
        </Stack>
    )
}

/** What one question of the list is given. */
interface QuestionItemProps {
    readonly row: QuestionRow
    readonly isOpen: boolean
    readonly answer: ActionHandle
    readonly onOpen: () => void
    readonly onClose: () => void
}

/** One question: the words, the entry it is about and when it was asked, then the way to answer. */
const QuestionItem = (props: QuestionItemProps): ReactNode => {
    const words = useBlockWords()
    const { row } = props
    const about = row.source === "" ? "" : words({ key: "question_about" }).replaceAll("{source}", row.source)
    const asked = row.asked === "" ? "" : words({ key: "question_asked" }).replaceAll("{time}", row.asked)
    const meta = [about, asked].filter((part) => part !== "").join(" \u00b7 ")
    return (
        <Stack gap="row">
            <Text isStrong>{row.question}</Text>
            {meta === "" ? null : (
                <Text size="sm" tone="muted">
                    {meta}
                </Text>
            )}
            {props.isOpen ? (
                <AnswerForm row={row} answer={props.answer} onDone={props.onClose} />
            ) : (
                <Cluster gap="inline" justify="start">
                    <Button intent="neutral" isDisabled={!props.answer.isAllowed} onPress={props.onOpen}>
                        {words({ key: "answer_command" })}
                    </Button>
                </Cluster>
            )}
        </Stack>
    )
}

/** The questions the owner is asked, with the count of those that wait and an answer in place. */
export const QuestionsBlock = (props: RenderOf<typeof accountingQuestionsBlock>): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.empty)
    const [openId, setOpenId] = useState<string | null>(null)
    const read = props.slots.questions
    return (
        <SlotView
            slot={rowsSlot(parsedSlot(read.slot, questionsRecord))}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <Stack gap="section">
                    <Cluster gap="inline" align="center">
                        <Heading level={3}>{words(props.props.label)}</Heading>
                        {record.count === null ? null : <Badge tone="accent">{record.count}</Badge>}
                    </Cluster>
                    {questionRowsOf(record).map((row, index) => (
                        <Stack key={row.id} gap="row">
                            {index === 0 ? null : <Divider />}
                            <QuestionItem
                                row={row}
                                isOpen={!isLoading && openId === row.id}
                                answer={props.slots.answer}
                                onOpen={() => setOpenId(row.id)}
                                onClose={() => setOpenId(null)}
                            />
                        </Stack>
                    ))}
                </Stack>
            )}
        />
    )
}
