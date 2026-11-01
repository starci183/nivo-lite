import { Button, Cluster, Form, SectionHeader, Stack } from "@starci/grammar/common"
import type { AgentGraphDecideEditorView, AgentGraphFormChange } from "@/modules/types"
import { RowCard } from "./RowCard"

/** The editor of a decision point: its rows, and the commands that change, keep or drop them. */
interface AgentGraphDecideEditorProps {
    readonly view: AgentGraphDecideEditorView
    readonly isSkeleton: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
    readonly onSave: () => void
    readonly onCancel: () => void
}

/**
 * Edits a decision point as rows, never as text: each branch is a card with its condition rows (a fact, how it is compared, a
 * value), what happens, who is asked, how long they have and who takes over. The owner adds, removes and reorders the branches; the
 * last one is the "else" and stays last. What is wrong with a branch shows under it, in plain words.
 */
export const AgentGraphDecideEditor = (props: AgentGraphDecideEditorProps) => {
    const { view } = props
    return (
        <>
            <SectionHeader level={3} title={view.title} description={view.hint} isSkeleton={props.isSkeleton} />
            <Form label={view.title} onSubmit={props.onSave}>
                <Stack gap="section">
                    {view.rows.map((row) => (
                        <RowCard
                            key={row.id}
                            view={view}
                            row={row}
                            isSkeleton={props.isSkeleton}
                            onChange={props.onChange}
                        />
                    ))}
                    <Cluster gap="inline">
                        <Button
                            intent="alternative"
                            size="sm"
                            isDisabled={!view.canAddRow}
                            isSkeleton={props.isSkeleton}
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
                    isSkeleton={props.isSkeleton}
                    onPress={props.onSave}
                >
                    {view.saveLabel}
                </Button>
                <Button intent="dismiss" size="sm" isSkeleton={props.isSkeleton} onPress={props.onCancel}>
                    {view.cancelLabel}
                </Button>
            </Cluster>
        </>
    )
}
