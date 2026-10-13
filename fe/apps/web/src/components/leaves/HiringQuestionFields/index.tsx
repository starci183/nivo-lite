import { Button, Input, Select, SurfaceCard, Switch } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import type { HiringQuestionValues } from "@/hooks/hiringJobs"
import { ACTIONS_CLASS_NAME, FIELDS_CLASS_NAME, GRID_CLASS_NAME } from "./classNames"

/** One question of the job editor and the way to change or remove it. */
interface HiringQuestionFieldsProps {
    readonly say: HiringSay
    readonly index: number
    readonly question: HiringQuestionValues
    readonly typeOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onPatch: (patch: Partial<HiringQuestionValues>) => void
    readonly onRemove: () => void
}

/** The fields of one question: its text, the kind of answer, the answer worth a point, and whether it is required. */
export const HiringQuestionFields = (props: HiringQuestionFieldsProps) => {
    const { say, index, question, typeOptions, onPatch } = props
    const id = question.id
    return (
        <SurfaceCard depth="nested" ariaLabel={say("qNumber", { n: index + 1 })}>
            <div className={FIELDS_CLASS_NAME}>
                <Input
                    id={`job-q-${id}`}
                    name={`q_${id}`}
                    label={say("qNumber", { n: index + 1 })}
                    variant="secondary"
                    value={question.text}
                    onValueChange={(text) => onPatch({ text })}
                />
                <div className={GRID_CLASS_NAME}>
                    <Select
                        variant="secondary"
                        label={say("qType")}
                        options={typeOptions}
                        value={question.type}
                        onValueChange={(type) => onPatch({ type: type ?? "text", expect: "" })}
                    />
                    {question.type === "yesno" ? (
                        <Select
                            variant="secondary"
                            label={say("qExpect")}
                            options={[
                                { id: "", label: say("qExpectNone") },
                                { id: "yes", label: say("yes") },
                                { id: "no", label: say("no") },
                            ]}
                            value={question.expect}
                            onValueChange={(expect) => onPatch({ expect: expect ?? "" })}
                        />
                    ) : null}
                    {question.type === "number" ? (
                        <Input
                            id={`job-qe-${id}`}
                            name={`qe_${id}`}
                            label={say("qExpectNumber")}
                            variant="secondary"
                            value={question.expect}
                            onValueChange={(expect) => onPatch({ expect })}
                        />
                    ) : null}
                    {question.type === "choice" ? (
                        <Input
                            id={`job-qc-${id}`}
                            name={`qc_${id}`}
                            label={say("qChoices")}
                            variant="secondary"
                            value={question.choices}
                            onValueChange={(choices) => onPatch({ choices })}
                        />
                    ) : null}
                </div>
                {question.type === "choice" ? (
                    <Input
                        id={`job-qx-${id}`}
                        name={`qx_${id}`}
                        label={say("qExpectChoices")}
                        variant="secondary"
                        value={question.expect}
                        onValueChange={(expect) => onPatch({ expect })}
                    />
                ) : null}
                <div className={ACTIONS_CLASS_NAME}>
                    <Switch
                        label={say("qRequired")}
                        isSelected={question.required}
                        onSelectedChange={(required) => onPatch({ required })}
                    />
                    <Button variant="ghost" size="sm" onPress={props.onRemove}>
                        {say("qRemove")}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    )
}
