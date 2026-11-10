import {
    Alert,
    Badge,
    Button,
    Cluster,
    Icon,
    Drawer,
    Form,
    Input,
    NumberField,
    Select,
    Stack,
    SurfaceCard,
    Sublabel,
    Switch,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { StepAction, StepDrawerView, StepFieldValue, StepFieldView } from "@/modules/types"
import { StepBindings, StepCall, StepOutputs, StepPicker, StepTriggers } from "./StepContract"

/** What the drawer of a step draws and what it does. */
interface WorkflowStepDrawerProps {
    readonly view: StepDrawerView
    readonly onAction: (action: StepAction) => void
}

/** What one setting draws: the setting, whether it can be changed, and where a change goes. */
interface StepFieldProps {
    readonly field: StepFieldView
    readonly isReadOnly: boolean
    readonly onAction: (action: StepAction) => void
}

/** What the branch list draws. */
interface StepBranchesProps {
    readonly view: StepDrawerView
}

/** The id of the form, which the save button of the footer submits. */
const FORM_ID = "workflow-step-form"

/** The number format of a setting: money in dong with the thousands of the language, a duration or a count with its unit. */
const formatOf = (field: StepFieldView): Intl.NumberFormatOptions => {
    if (field.input === "money") return { style: "currency", currency: "VND", maximumFractionDigits: 0 }
    if (field.unit !== undefined) return { style: "unit", unit: field.unit, unitDisplay: "long" }
    return { maximumFractionDigits: 0 }
}

/** The props every control of a setting shares: its name, label, help line, the error and whether it can be changed. */
const sharedOf = (field: StepFieldView, isReadOnly: boolean) => ({
    name: field.name,
    label: field.label,
    ...(field.description === "" ? {} : { description: field.description }),
    ...(field.error === "" ? {} : { errorMessage: field.error }),
    isReadOnly,
})

/** One setting as the control its input asks for. */
const StepField = (props: StepFieldProps) => {
    const { field, isReadOnly } = props
    const change = (value: StepFieldValue) => props.onAction({ kind: "change", name: field.name, value })
    const id = `${FORM_ID}-${field.name}`
    const shared = sharedOf(field, isReadOnly)
    switch (field.input) {
        case "money":
        case "duration":
        case "number":
            return (
                <NumberField
                    id={id}
                    {...shared}
                    {...(typeof field.value === "number" ? { value: field.value } : {})}
                    {...(field.min === undefined ? {} : { minValue: field.min })}
                    {...(field.max === undefined ? {} : { maxValue: field.max })}
                    formatOptions={formatOf(field)}
                    hideSteppers={isReadOnly || field.input === "money"}
                    onValueChange={(value) => change(Number.isNaN(value) ? null : value)}
                />
            )
        case "enum":
            return (
                <Select
                    {...shared}
                    isDisabled={isReadOnly}
                    options={field.options}
                    value={typeof field.value === "string" ? field.value : null}
                    onValueChange={(value) => change(value)}
                />
            )
        case "boolean":
            return (
                <Switch
                    {...shared}
                    // A labelled switch says what turning it on does: the setting's help, else its own label.
                    description={field.description === "" ? field.label : field.description}
                    isSelected={field.value === true}
                    onSelectedChange={(isSelected) => change(isSelected)}
                />
            )
        case "paragraph":
            return (
                <Textarea
                    id={id}
                    {...shared}
                    value={typeof field.value === "string" ? field.value : ""}
                    onValueChange={(value) => change(value)}
                />
            )
        case "text":
            return (
                <Input
                    id={id}
                    {...shared}
                    value={typeof field.value === "string" ? field.value : ""}
                    onValueChange={(value) => change(value)}
                />
            )
    }
}

/**
 * The settings of the step: a bordered card under its Sublabel. The trigger, a hand-off and an outcome edit their own groups instead,
 * so they draw none when they have no setting.
 */
const StepFields = (props: WorkflowStepDrawerProps) => {
    const { view } = props
    if (view.fields.length === 0 && (view.triggers.length > 0 || view.call !== null || view.bindings.length > 0)) return null
    return (
        <Stack gap="row">
            <Sublabel>{view.fieldsTitle}</Sublabel>
            <SurfaceCard ariaLabel={view.fieldsTitle}>
                {view.fields.length === 0 ? (
                    <Text size="sm" tone="muted">
                        {view.emptyNote}
                    </Text>
                ) : (
                    <Stack gap="row">
                        {view.fields.map((field) => (
                            <StepField key={field.name} field={field} isReadOnly={view.isReadOnly} onAction={props.onAction} />
                        ))}
                    </Stack>
                )}
            </SurfaceCard>
        </Stack>
    )
}

/** The branches of a condition, read only: a bordered list card under its Sublabel, each row the port name as a chip, an outline arrow and the step it leads to. */
const StepBranches = (props: StepBranchesProps) =>
    props.view.branches.length === 0 ? null : (
        <Stack gap="row">
            <Sublabel>{props.view.branchesTitle}</Sublabel>
            <SurfaceCard
            kind="list"
            ariaLabel={props.view.branchesTitle}
            empty={null}
            items={props.view.branches.map((branch) => ({
                id: branch.id,
                title: "",
                detail: (
                    <Cluster gap="inline" align="center" wrap={false}>
                        <Badge tone="neutral">{branch.output}</Badge>
                        <Icon source={nivoIconSource("next", "chip")} usage="chip" />
                        <Text>{branch.step}</Text>
                    </Cluster>
                ),
            }))}
            />
        </Stack>
    )

/** The foot of an editable drawer: cancel, and save as the next version (the one primary of the drawer). */
const StepFooter = (props: WorkflowStepDrawerProps) => (
    <>
        <Button intent="dismiss" isDisabled={props.view.isSaving} onPress={() => props.onAction({ kind: "close" })}>
            {props.view.cancelLabel}
        </Button>
        <Button
            type="submit"
            form={FORM_ID}
            intent="commit"
            size="md"
            isDisabled={!props.view.canSave}
            isPending={props.view.isSaving}
        >
            {props.view.saveLabel}
        </Button>
    </>
)

/**
 * The drawer of one step, on the right: the step's title and line, the form of its settings generated from the node (money in dong,
 * a duration with its unit, a choice, a text, a switch; limits checked, the help as each field's description), the branches of a
 * condition read only, and the save that writes the workflow's next version. A run's drawer is read only: the settings the run used.
 */
export const WorkflowStepDrawer = (props: WorkflowStepDrawerProps) => {
    const { view } = props
    return (
        <Drawer
            isOpen={view.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.onAction({ kind: "close" })
            }}
            title={view.title}
            description={view.description}
            closeLabel={view.closeLabel}
            {...(view.isReadOnly ? {} : { footer: <StepFooter {...props} /> })}
        >
            <Form
                id={FORM_ID}
                label={view.title}
                onSubmit={() => props.onAction({ kind: "save" })}
                isPending={view.isSaving}
            >
                <Stack gap="section">
                    {view.isReadOnly ? (
                        <Text size="sm" tone="muted">
                            {view.readOnlyNote}
                        </Text>
                    ) : null}
                    <StepPicker {...props} />
                    <StepTriggers {...props} />
                    <StepCall {...props} />
                    <StepFields {...props} />
                    <StepBindings {...props} />
                    <StepOutputs {...props} />
                    <StepBranches view={view} />
                    {view.error === "" ? null : (
                        <Alert tone="negative" title={view.errorTitle} description={view.error} />
                    )}
                </Stack>
            </Form>
        </Drawer>
    )
}
