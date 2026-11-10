import { Badge, Cluster, Input, Select, Stack, Sublabel, SurfaceCard, Text, Tooltip } from "@starci/grammar/common"
import type { StepAction, StepBindingView, StepDrawerView, StepTriggerView } from "@/modules/types"

/*
 * The contract groups of the step drawer: each group a bordered card on the drawer's white with its Sublabel above (the law of a
 * surface on a surface). The workflow's inputs on the trigger step, the target of a hand-off, the data params with their output picker
 * (a ref as a pink chip `= order.id`, a fixed value plain), what the step answers, and the picker of a new step.
 */

/** What every group draws and where its changes go. */
interface GroupProps {
    readonly view: StepDrawerView
    readonly onAction: (action: StepAction) => void
}

/** A group: its Sublabel above, its bordered card. */
const Group = (props: { readonly title: string; readonly children: React.ReactNode }) => (
    <Stack gap="row">
        <Sublabel>{props.title}</Sublabel>
        <SurfaceCard ariaLabel={props.title}>{props.children}</SurfaceCard>
    </Stack>
)

/** The current binding of a param: a pink chip for a ref, the plain value for a fixed one, nothing when unbound. */
const BindingValue = (props: { readonly binding: StepBindingView }) => {
    // The chip says where the value comes from in words; its path (`= steps.record.output.orderId`) only on hover.
    if (props.binding.kind === "ref")
        return (
            <Tooltip
                content={`= ${props.binding.ref ?? ""}`}
                trigger={<Badge tone="accent">{props.binding.text}</Badge>}
            />
        )
    if (props.binding.kind === "fixed") return <Text>{props.binding.text}</Text>
    return null
}

/** One param: its words and type, its binding, the output picker (the refs that fit) and the fixed value. */
const BindingRow = (props: GroupProps & { readonly binding: StepBindingView }) => {
    const { binding, view } = props
    const bind = (next: { readonly kind: "ref"; readonly ref: string } | { readonly kind: "fixed"; readonly value: string }) =>
        props.onAction({ kind: "bind", name: binding.name, binding: next })
    return (
        <Stack gap="row">
            <Cluster gap="inline" align="center">
                <Text isStrong>{binding.label}</Text>
                {binding.typeLabel === "" ? null : <Badge tone="neutral">{binding.typeLabel}</Badge>}
                <BindingValue binding={binding} />
            </Cluster>
            {view.isReadOnly ? null : (
                <>
                    <Select
                        label={view.refLabel}
                        options={binding.options.map((option) => ({
                            id: option.id,
                            label: option.label,
                            description: option.group,
                        }))}
                        value={binding.ref}
                        isRequired={binding.required}
                        {...(binding.error === "" ? {} : { errorMessage: binding.error, isInvalid: true })}
                        onValueChange={(ref) => {
                            if (ref !== null) bind({ kind: "ref", ref })
                        }}
                    />
                    <Input
                        id={`step-binding-${binding.name}`}
                        name={`fixed-${binding.name}`}
                        label={view.fixedLabel}
                        value={binding.kind === "fixed" ? binding.text : ""}
                        onValueChange={(value) => bind({ kind: "fixed", value })}
                    />
                </>
            )}
        </Stack>
    )
}

/** The data params of the step with their bindings. */
export const StepBindings = (props: GroupProps) =>
    props.view.bindings.length === 0 ? null : (
        <Group title={props.view.bindingsTitle}>
            <Stack gap="section">
                {props.view.bindings.map((binding) => (
                    <BindingRow key={binding.name} {...props} binding={binding} />
                ))}
            </Stack>
        </Group>
    )

/** One input of the workflow: the "Nguồn" select, its conditions and the params it supplies, as chips. */
const TriggerCard = (props: GroupProps & { readonly trigger: StepTriggerView }) => {
    const { trigger, view } = props
    return (
        <Stack gap="row">
            <Select
                label={view.sourceLabel}
                options={trigger.sourceOptions}
                value={trigger.source}
                isDisabled={view.isReadOnly}
                {...(trigger.error === "" ? {} : { errorMessage: trigger.error, isInvalid: true })}
                onValueChange={(source) => {
                    if (source !== null) props.onAction({ kind: "set-source", triggerKey: trigger.key, source })
                }}
            />
            <Sublabel>{view.conditionsLabel}</Sublabel>
            {trigger.conditions.length === 0 ? (
                <Text tone="muted">{view.noConditions}</Text>
            ) : (
                trigger.conditions.map((condition) => <Text key={condition}>{condition}</Text>)
            )}
            <Sublabel>{view.paramsLabel}</Sublabel>
            <Cluster gap="inline">
                {trigger.params.map((param) => (
                    <Badge key={param.name} tone="neutral">
                        {param.label}
                    </Badge>
                ))}
            </Cluster>
        </Stack>
    )
}

/** The inputs of the workflow, one card each, on the trigger step. */
export const StepTriggers = (props: GroupProps) =>
    props.view.triggers.length === 0 ? null : (
        <Stack gap="section">
            {props.view.triggers.map((trigger) => (
                <Group key={trigger.key} title={props.view.triggersTitle}>
                    <TriggerCard {...props} trigger={trigger} />
                </Group>
            ))}
        </Stack>
    )

/** The target of an end hand-off: the workflow it calls and the version. */
export const StepCall = (props: GroupProps) => {
    const call = props.view.call
    if (call === null) return null
    return (
        <Group title={props.view.targetLabel}>
            <Stack gap="row">
                <Select
                    label={props.view.targetLabel}
                    isLabelHidden
                    options={call.targetOptions}
                    value={call.target}
                    isDisabled={props.view.isReadOnly}
                    {...(call.error === "" ? {} : { errorMessage: call.error, isInvalid: true })}
                    onValueChange={(target) => {
                        if (target !== null) props.onAction({ kind: "set-call", target })
                    }}
                />
                <Text tone="muted" size="sm">
                    {call.versionLabel}
                </Text>
            </Stack>
        </Group>
    )
}

/** What the step answers, which later steps bind to: each output with its type. */
export const StepOutputs = (props: GroupProps) =>
    props.view.outputs.length === 0 ? null : (
        <Stack gap="row">
            <Sublabel>{props.view.outputsTitle}</Sublabel>
            <SurfaceCard
                ariaLabel={props.view.outputsTitle}
                kind="list"
                items={props.view.outputs.map((output) => ({
                    id: output.name,
                    title: output.label,
                    ...(output.typeLabel === "" ? {} : { description: output.typeLabel }),
                }))}
                empty={null}
            />
        </Stack>
    )

/** The picker of a new step's kind: a choice list (a select card, one row per kind with its line as the subtitle); choosing inserts the step. */
export const StepPicker = (props: GroupProps) =>
    !props.view.picker.isOpen ? null : (
        <Stack gap="row">
            <Sublabel>{props.view.pickerTitle}</Sublabel>
            <SurfaceCard
                ariaLabel={props.view.pickerTitle}
                kind="select"
                selectionMode="single"
                value={null}
                items={props.view.picker.options.map((option) => ({
                    id: option.id,
                    title: option.label,
                    subtitle: option.description,
                }))}
                onChange={(step) => props.onAction({ kind: "pick-step", step })}
            />
        </Stack>
    )
