import { Input, RadioGroup, Textarea } from "@starci/grammar/common"
import type { ApplyValues, HiringSay, PublicQuestionView } from "@/modules/types"

/** What one screening question draws and reports. */
interface HiringApplyQuestionProps {
    readonly question: PublicQuestionView
    readonly say: HiringSay
    readonly values: ApplyValues
    readonly isBusy: boolean
    readonly onAnswer: (id: string, answer: string) => void
}

/** One screening question of the job, drawn as the control its type asks for: yes or no, a choice, a number or free text. */
export const HiringApplyQuestion = (props: HiringApplyQuestionProps) => {
    const { question, say, values, isBusy } = props
    const answer = values.answers[question.id] ?? ""
    const common = { label: question.text, isRequired: question.required, isDisabled: isBusy }
    const set = (value: string) => props.onAnswer(question.id, value)
    if (question.type === "yesno") {
        return (
            <RadioGroup
                key={question.id}
                {...common}
                name={`q_${question.id}`}
                orientation="horizontal"
                options={[
                    { value: say("yes"), label: say("yes") },
                    { value: say("no"), label: say("no") },
                ]}
                value={answer === "" ? null : answer}
                onValueChange={set}
            />
        )
    }
    if (question.type === "choice") {
        return (
            <RadioGroup
                key={question.id}
                {...common}
                name={`q_${question.id}`}
                options={question.choices.map((choice) => ({ value: choice, label: choice }))}
                value={answer === "" ? null : answer}
                onValueChange={set}
            />
        )
    }
    if (question.type === "number") {
        return (
            <Input
                key={question.id}
                id={`apply-q-${question.id}`}
                name={`q_${question.id}`}
                {...common}
                value={answer}
                onValueChange={set}
            />
        )
    }
    return (
        <Textarea
            key={question.id}
            {...common}
            name={`q_${question.id}`}
            rows={3}
            maxLength={1000}
            value={answer}
            onValueChange={set}
        />
    )
}
