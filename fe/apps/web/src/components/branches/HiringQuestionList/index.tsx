import { Button, Heading, Text } from "@starci/grammar/common"
import { HiringQuestionFields } from "@/components/leaves/HiringQuestionFields"
import type { HiringSay } from "@/hooks/hiring"
import type { HiringQuestionValues } from "@/hooks/hiringJobs"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** The questions of a job and the ways to change the list. */
interface HiringQuestionListProps {
    readonly say: HiringSay
    readonly questions: ReadonlyArray<HiringQuestionValues>
    readonly typeOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly canAdd: boolean
    readonly onPatch: (index: number, patch: Partial<HiringQuestionValues>) => void
    readonly onAdd: () => void
    readonly onRemove: (index: number) => void
}

/** The questions a job asks its candidates, each editable, with the button that adds one. */
export const HiringQuestionList = (props: HiringQuestionListProps) => {
    const { say, questions, typeOptions, canAdd, onPatch, onAdd, onRemove } = props
    return (
        <>
            <Heading level={3}>{say("jobQuestions")}</Heading>
            <Text size="sm" tone="muted">
                {say("jobQuestionsHint")}
            </Text>
            {questions.map((question, index) => (
                <HiringQuestionFields
                    key={question.id}
                    say={say}
                    index={index}
                    question={question}
                    typeOptions={typeOptions}
                    onPatch={(patch) => onPatch(index, patch)}
                    onRemove={() => onRemove(index)}
                />
            ))}
            {canAdd ? (
                <div className={ACTIONS_CLASS_NAME}>
                    <Button variant="secondary" size="sm" onPress={onAdd}>
                        {say("qAdd")}
                    </Button>
                </div>
            ) : null}
        </>
    )
}
