import { Input, NumberField, Select } from "@starci/grammar/common"
import type { AgentGraphDecideEditorView, AgentGraphFormChange, AgentGraphTermView } from "@/modules/types"
/** One typed fact value control, resolved before drawing. */
interface AgentGraphTermValueProps {
    readonly term: Pick<AgentGraphTermView, "id" | "input" | "amount" | "amountWords" | "text" | "valueOptions">
    readonly rowIndex: number
    readonly at: number
    readonly labels: Pick<AgentGraphDecideEditorView["labels"], "amount" | "value">
    readonly isLoading: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
}

/** The value of a term: a number, one of a few values, free words, or nothing when the comparison needs none. */
export const AgentGraphTermValue = (props: AgentGraphTermValueProps) => {
    const { term, labels } = props
    const set = (field: "amount" | "text", value: string | number) =>
        props.onChange({ kind: "setTerm", row: props.rowIndex, term: props.at, field, value })
    if (term.input === "number")
        return (
            <NumberField
                label={labels.amount}
                value={term.amount}
                minValue={0}
                step={1_000_000}
                description={term.amountWords === "" ? undefined : term.amountWords}
                isLoading={props.isLoading}
                onValueChange={(value) => {
                    if (!Number.isNaN(value)) set("amount", value)
                }}
            />
        )
    if (term.input === "choice")
        return (
            <Select
                label={labels.value}
                options={term.valueOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={term.text === "" ? null : term.text}
                isLoading={props.isLoading}
                onValueChange={(value) => set("text", value ?? "")}
            />
        )
    if (term.input === "text")
        return (
            <Input
                id={term.id}
                name={term.id}
                label={labels.value}
                value={term.text}
                isLoading={props.isLoading}
                onValueChange={(value) => set("text", value)}
            />
        )
    return null
}
