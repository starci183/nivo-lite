import { Button, Cluster, FormGrid, Input, NumberField, Select, Stack } from "@starci/grammar/common"
import { selected } from "./rowProps"
import type { TermProps, TermRowProps } from "./rowProps"

/** The value of a term: a number, one of a few values, free words, or nothing when the comparison needs none. */
const ValueField = (props: TermProps) => {
    const { term, row, view } = props
    const set = (field: "amount" | "text", value: string | number) =>
        props.onChange({ kind: "setTerm", row: row.index, term: props.at, field, value })
    if (term.input === "number")
        return (
            <NumberField
                label={view.labels.amount}
                value={term.amount}
                minValue={0}
                step={1_000_000}
                description={term.amountWords === "" ? undefined : term.amountWords}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => {
                    if (!Number.isNaN(value)) set("amount", value)
                }}
            />
        )
    if (term.input === "choice")
        return (
            <Select
                label={view.labels.value}
                options={term.valueOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={selected(term.text)}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => set("text", value ?? "")}
            />
        )
    if (term.input === "text")
        return (
            <Input
                id={term.id}
                name={term.id}
                label={view.labels.value}
                value={term.text}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => set("text", value)}
            />
        )
    return null
}

/** One comparison of a row: the fact, how it is compared, the value, and the command that takes it away. */
export const TermRow = (props: TermRowProps) => {
    const { term, row, view } = props
    const set = (field: "fact" | "op", value: string) =>
        props.onChange({ kind: "setTerm", row: row.index, term: props.at, field, value })
    return (
        <Stack gap="row">
            <Select
                label={view.labels.fact}
                options={view.factOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={selected(term.fact)}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => set("fact", value ?? "")}
            />
            <FormGrid columns={2}>
                <Select
                    label={view.labels.op}
                    options={term.opOptions.map((option) => ({ id: option.value, label: option.label }))}
                    value={term.op}
                    isSkeleton={props.isSkeleton}
                    onValueChange={(value) => set("op", value ?? term.op)}
                />
                <ValueField {...props} />
            </FormGrid>
            {term.canRemove ? (
                <Cluster gap="inline">
                    <Button
                        intent="neutral"
                        size="sm"
                        isSkeleton={props.isSkeleton}
                        onPress={() => props.onChange({ kind: "removeTerm", row: row.index, term: props.at })}
                    >
                        {view.labels.removeTerm}
                    </Button>
                </Cluster>
            ) : null}
        </Stack>
    )
}
