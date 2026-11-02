import { Stack, Grid, Cluster, Button, Input, Select, SurfaceCard, Switch } from "@starci/grammar/common"

import type { HiringQuestionValues, HiringViews } from "@/modules/types"

/** One question of the job editor and the way to change or remove it. */
interface HiringQuestionFieldsProps {
    readonly copy: HiringViews["workbenchCopy"]
    readonly numberLabel: string
    readonly question: HiringViews["questionData"]
    readonly typeOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onPatch: (patch: Partial<HiringQuestionValues>) => void
    readonly onRemove: () => void
}

/** The fields of one question: its text, the kind of answer, the answer worth a point, and whether it is required. */
export const HiringQuestionFields = (props: HiringQuestionFieldsProps) => {
    const { copy, numberLabel, question, typeOptions, onPatch } = props
    const id = question.id
    return (
        <SurfaceCard ariaLabel={numberLabel}>
            <Stack gap="row">
                <Input
                    id={`job-q-${id}`}
                    name={`q_${id}`}
                    label={numberLabel}
                    value={question.text}
                    onValueChange={(text) => onPatch({ text })}
                />
                <Grid kind="form" columns={2}>
                    <Select
                        label={copy.qType}
                        options={typeOptions}
                        value={question.type}
                        onValueChange={(type) => onPatch({ type: type ?? "text", expect: "" })}
                    />
                    {question.type === "yesno" ? (
                        <Select
                            label={copy.qExpect}
                            options={[
                                { id: "", label: copy.qExpectNone },
                                { id: "yes", label: copy.yes },
                                { id: "no", label: copy.no },
                            ]}
                            value={question.expect}
                            onValueChange={(expect) => onPatch({ expect: expect ?? "" })}
                        />
                    ) : null}
                    {question.type === "number" ? (
                        <Input
                            id={`job-qe-${id}`}
                            name={`qe_${id}`}
                            label={copy.qExpectNumber}
                            value={question.expect}
                            onValueChange={(expect) => onPatch({ expect })}
                        />
                    ) : null}
                    {question.type === "choice" ? (
                        <Input
                            id={`job-qc-${id}`}
                            name={`qc_${id}`}
                            label={copy.qChoices}
                            value={question.choices}
                            onValueChange={(choices) => onPatch({ choices })}
                        />
                    ) : null}
                </Grid>
                {question.type === "choice" ? (
                    <Input
                        id={`job-qx-${id}`}
                        name={`qx_${id}`}
                        label={copy.qExpectChoices}
                        value={question.expect}
                        onValueChange={(expect) => onPatch({ expect })}
                    />
                ) : null}
                <Cluster gap="inline">
                    <Switch
                        label={copy.qRequired}
                        isSelected={question.required}
                        onSelectedChange={(required) => onPatch({ required })}
                    />
                    <Button intent="alternative" onPress={props.onRemove}>
                        {copy.qRemove}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    )
}
