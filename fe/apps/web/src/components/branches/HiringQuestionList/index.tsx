import { Button, Heading, Text, Cluster } from "@starci/grammar/common"
import { HiringQuestionFields } from "@/components/leaves/HiringQuestionFields"
import type { HiringQuestionValues, HiringViews } from "@/modules/types"
/** The questions of a job and the ways to change the list. */
interface HiringQuestionListProps {
    readonly copy: HiringViews["workbenchCopy"]
    readonly questions: ReadonlyArray<{ readonly question: HiringViews["questionData"]; readonly numberLabel: string }>
    readonly typeOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly canAdd: boolean
    readonly onPatch: (index: number, patch: Partial<HiringQuestionValues>) => void
    readonly onAdd: () => void
    readonly onRemove: (index: number) => void
}

/** The questions a job asks its candidates, each editable, with the button that adds one. */
export const HiringQuestionList = (props: HiringQuestionListProps) => {
    const { copy, questions, typeOptions, canAdd, onPatch, onAdd, onRemove } = props
    return (
        <>
            <Heading level={3}>{copy.jobQuestions}</Heading>
            <Text size="sm" tone="muted">
                {copy.jobQuestionsHint}
            </Text>
            {questions.map((entry, index) => (
                <HiringQuestionFields
                    key={entry.question.id}
                    copy={copy}
                    numberLabel={entry.numberLabel}
                    question={entry.question}
                    typeOptions={typeOptions}
                    onPatch={(patch) => onPatch(index, patch)}
                    onRemove={() => onRemove(index)}
                />
            ))}
            {canAdd ? (
                <Cluster gap="inline">
                    <Button intent="neutral" size="sm" onPress={onAdd}>
                        {copy.qAdd}
                    </Button>
                </Cluster>
            ) : null}
        </>
    )
}
