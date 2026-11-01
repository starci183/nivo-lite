import {
    Alert,
    Button,
    Form,
    FormGrid,
    NumberField,
    SectionHeader,
    SegmentedControl,
    Select,
    Text,
} from "@starci/grammar/common"
import type { AgentGraphBranchForm, AgentGraphEditorView } from "@/modules/types"

/** The form of one branch while the owner edits it, and the commands that keep or drop the change. */
interface AgentGraphEditorProps {
    readonly view: AgentGraphEditorView
    readonly isSkeleton: boolean
    readonly onField: (name: keyof AgentGraphBranchForm, value: string | number) => void
    readonly onSave: () => void
    readonly onCancel: () => void
}

/** The fields about the person who is asked: who, how long they have, and what happens after. */
type ApproverFieldsProps = Pick<AgentGraphEditorProps, "view" | "isSkeleton" | "onField">

/** An empty selection is no selection. */
const selected = (value: string): string | null => (value === "" ? null : value)

/** The approver, the wait, what happens when nobody answers and, when someone takes over, who. */
const ApproverFields = (props: ApproverFieldsProps) => {
    const { view } = props
    const { form } = view
    const members = view.memberOptions.map((option) => ({ id: option.value, label: option.label }))
    return (
        <>
            <Select
                label={view.labels.approver}
                options={members}
                value={selected(form.approverId)}
                description={view.approverHelp === "" ? undefined : view.approverHelp}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => props.onField("approverId", value ?? "")}
            />
            <NumberField
                label={view.labels.hours}
                value={form.timeoutHours}
                minValue={1}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => props.onField("timeoutHours", value)}
            />
            <Select
                label={view.labels.onTimeout}
                options={view.timeoutOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={form.onTimeout}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => props.onField("onTimeout", value ?? "unset")}
            />
            {form.onTimeout === "backup" ? (
                <Select
                    label={view.labels.backup}
                    options={members}
                    value={selected(form.backupId)}
                    isSkeleton={props.isSkeleton}
                    onValueChange={(value) => props.onField("backupId", value ?? "")}
                />
            ) : null}
        </>
    )
}

/**
 * Edits a branch in a form, never in text: the amount it starts and ends at, what it does, who is asked, how long they have and who
 * takes over. The right of the chosen person is checked against the top of the branch before the draft takes it, and the box under
 * the form says what saving would change.
 */
export const AgentGraphEditor = (props: AgentGraphEditorProps) => {
    const { view } = props
    const { form } = view
    return (
        <>
            <SectionHeader level={3} title={view.title} description={view.hint} isSkeleton={props.isSkeleton} />
            <Form label={view.title} onSubmit={props.onSave}>
                <FormGrid columns={1}>
                    <NumberField
                        label={view.labels.from}
                        value={form.fromVnd}
                        minValue={0}
                        step={1_000_000}
                        isSkeleton={props.isSkeleton}
                        onValueChange={(value) => props.onField("fromVnd", value)}
                    />
                    <NumberField
                        label={view.labels.to}
                        value={form.toVnd}
                        minValue={0}
                        step={1_000_000}
                        isSkeleton={props.isSkeleton}
                        onValueChange={(value) => props.onField("toVnd", value)}
                    />
                    <SegmentedControl
                        label={view.labels.then}
                        width="fill"
                        options={view.thenOptions}
                        value={form.then}
                        isSkeleton={props.isSkeleton}
                        onValueChange={(value) => props.onField("then", value)}
                    />
                    {form.then === "ask" ? <ApproverFields {...props} /> : null}
                </FormGrid>
            </Form>
            {view.rightText === "" ? null : (
                <Alert
                    title={view.rightText}
                    tone={view.rightTone === "covers" ? "affirmative" : "cautionary"}
                    appearance="soft"
                />
            )}
            {view.changes.length === 0 ? null : (
                <Alert
                    title={view.changesTitle}
                    tone="informative"
                    appearance="soft"
                    description={view.changes.map((line) => (
                        <Text key={line} as="p" size="sm">
                            {line}
                        </Text>
                    ))}
                />
            )}
            <Button
                intent="commit"
                size="sm"
                isDisabled={!view.isSavable}
                isSkeleton={props.isSkeleton}
                onPress={props.onSave}
            >
                {view.saveLabel}
            </Button>
            <Button intent="dismiss" size="sm" isSkeleton={props.isSkeleton} onPress={props.onCancel}>
                {view.cancelLabel}
            </Button>
        </>
    )
}
