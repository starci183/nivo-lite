import {
    Alert,
    Button,
    Cluster,
    Form,
    Stack,
    Section,
    SegmentedControl,
    SurfaceCard,
    Select,
    Grid,
} from "@starci/grammar/common"
import type {
    AgentGraphDecideEditorView,
    AgentGraphFormChange,
    AgentGraphRowView,
    AgentGraphTermView,
} from "@/modules/types"
import { AgentGraphRowSummary } from "@/components/leaves/AgentGraphRowSummary"
import { AgentGraphRowActions } from "@/components/leaves/AgentGraphRowActions"
import { AgentGraphAskFields } from "@/components/leaves/AgentGraphAskFields"
import { AgentGraphTermValue } from "@/components/leaves/AgentGraphTermValue"

/** The editor of a decision point: its rows, and the commands that change, keep or drop them. */
interface AgentGraphDecideEditorProps {
    readonly view: AgentGraphDecideEditorView
    readonly isLoading: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
    readonly onSave: () => void
    readonly onCancel: () => void
}

/** The private ready row anatomy of this editor. */
interface RowProps {
    readonly view: AgentGraphDecideEditorView
    readonly row: AgentGraphRowView
    readonly isLoading: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
}
interface TermProps extends RowProps {
    readonly term: AgentGraphTermView
    readonly at: number
}

/** What a closing "else" may do: ask or stop, never run alone. */
const thenOptionsOf = (props: RowProps) =>
    props.view.thenOptions.filter((option) => !props.row.isElse || option.value !== "auto")

/** One comparison of a row: the fact, how it is compared, the value, and the command that takes it away. */
const TermRow = (props: TermProps) => {
    const { term, row, view } = props
    const set = (field: "fact" | "op", value: string) =>
        props.onChange({ kind: "setTerm", row: row.index, term: props.at, field, value })
    return (
        <Stack gap="row">
            <Select
                label={view.labels.fact}
                options={view.factOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={term.fact === "" ? null : term.fact}
                isLoading={props.isLoading}
                onValueChange={(value) => set("fact", value ?? "")}
            />
            <Grid kind="form" columns={2}>
                <Select
                    label={view.labels.op}
                    options={term.opOptions.map((option) => ({ id: option.value, label: option.label }))}
                    value={term.op}
                    isLoading={props.isLoading}
                    onValueChange={(value) => set("op", value ?? term.op)}
                />
                <AgentGraphTermValue
                    term={term}
                    rowIndex={row.index}
                    at={props.at}
                    labels={view.labels}
                    isLoading={props.isLoading}
                    onChange={props.onChange}
                />
            </Grid>
            {term.canRemove ? (
                <Cluster gap="inline">
                    <Button
                        intent="neutral"
                        size="sm"
                        isLoading={props.isLoading}
                        onPress={() => props.onChange({ kind: "removeTerm", row: row.index, term: props.at })}
                    >
                        {view.labels.removeTerm}
                    </Button>
                </Cluster>
            ) : null}
        </Stack>
    )
}

/** One branch as a card: when it applies, what happens, who is asked, and what is wrong with it. */
const RowCard = (props: RowProps) => {
    const { row, view } = props
    return (
        <SurfaceCard label={row.title} headingLevel={3}>
            <Stack gap="section">
                <AgentGraphRowSummary row={row} labels={view.labels} isLoading={props.isLoading} />
                {row.terms.map((term, at) => (
                    <TermRow key={term.id} {...props} term={term} at={at} />
                ))}
                {row.canAddTerm ? (
                    <Cluster gap="inline">
                        <Button
                            intent="alternative"
                            size="sm"
                            isLoading={props.isLoading}
                            onPress={() => props.onChange({ kind: "addTerm", row: row.index })}
                        >
                            {view.labels.addTerm}
                        </Button>
                    </Cluster>
                ) : null}
                <SegmentedControl
                    label={view.labels.then}
                    width="fill"
                    options={thenOptionsOf(props)}
                    value={row.then}
                    isLoading={props.isLoading}
                    onValueChange={(value) => props.onChange({ kind: "setRow", row: row.index, field: "then", value })}
                />
                {row.then === "ask" ? (
                    <AgentGraphAskFields
                        row={row}
                        labels={view.labels}
                        timeoutOptions={view.timeoutOptions}
                        memberOptions={view.memberOptions}
                        isLoading={props.isLoading}
                        onChange={props.onChange}
                    />
                ) : null}
                {row.problems.map((problem) => (
                    <Alert key={problem} title={problem} tone="cautionary" appearance="soft" />
                ))}
                <AgentGraphRowActions
                    row={row}
                    labels={view.labels}
                    isLoading={props.isLoading}
                    onChange={props.onChange}
                />
            </Stack>
        </SurfaceCard>
    )
}

/**
 * Edits a decision point as rows, never as text: each branch is a card with its condition rows (a fact, how it is compared, a
 * value), what happens, who is asked, how long they have and who takes over. The owner adds, removes and reorders the branches; the
 * last one is the "else" and stays last. What is wrong with a branch shows under it, in plain words.
 */
export const AgentGraphDecideEditor = (props: AgentGraphDecideEditorProps) => {
    const { view } = props
    return (
        <Section title={view.title} description={view.hint} isLoading={props.isLoading} headingLevel={3}>
            <Form label={view.title} onSubmit={props.onSave}>
                <Stack gap="section">
                    {view.rows.map((row) => (
                        <RowCard
                            key={row.id}
                            view={view}
                            row={row}
                            isLoading={props.isLoading}
                            onChange={props.onChange}
                        />
                    ))}
                    <Cluster gap="inline">
                        <Button
                            intent="alternative"
                            size="sm"
                            isDisabled={!view.canAddRow}
                            isLoading={props.isLoading}
                            onPress={() => props.onChange({ kind: "addRow" })}
                        >
                            {view.addRowLabel}
                        </Button>
                    </Cluster>
                </Stack>
            </Form>
            <Cluster gap="inline">
                <Button
                    intent="commit"
                    size="sm"
                    isDisabled={view.saveBlocked !== ""}
                    {...(view.saveBlocked === "" ? {} : { disabledReason: view.saveBlocked })}
                    isLoading={props.isLoading}
                    onPress={props.onSave}
                >
                    {view.saveLabel}
                </Button>
                <Button intent="dismiss" size="sm" isLoading={props.isLoading} onPress={props.onCancel}>
                    {view.cancelLabel}
                </Button>
            </Cluster>
        </Section>
    )
}
