import type { FlowGraphEdge, FlowGraphLegendItem, FlowGraphNode, FlowGraphRunStatus } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "./slot"
import type { NodeRightMode } from "./node-rights"

/** The card map of a workflow as `FlowGraph layout="steps"` draws it: the cards, the edges, the kind legend and the status words. */
export interface StepsMapView {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
    readonly legend: ReadonlyArray<FlowGraphLegendItem>
    readonly statusLabels: Readonly<Record<FlowGraphRunStatus, string>>
}

/** How the owner edits one setting of a step. */
export type StepFieldInput = "money" | "duration" | "number" | "enum" | "text" | "paragraph" | "boolean"

/** The unit a duration or a number is shown in (an `Intl` unit). */
export type StepFieldUnit = "minute" | "hour" | "day"

/** What one setting holds in the form: a number, a word, a switch, or nothing yet. */
export type StepFieldValue = number | string | boolean | null

/** One setting of a step as the drawer draws it. */
export interface StepFieldView {
    readonly name: string
    readonly label: string
    /** The help line under the input. */
    readonly description: string
    readonly input: StepFieldInput
    /** The unit of a duration or a number; absent for the rest. */
    readonly unit?: StepFieldUnit
    readonly min?: number
    readonly max?: number
    /** The choices of an `enum`, with their words. */
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly value: StepFieldValue
    /** Why the value cannot be saved; empty when it can. */
    readonly error: string
}

/** One branch of a condition as the drawer lists it: the output (its port name) and the title of the step it leads to. */
export interface StepBranchView {
    readonly id: string
    readonly output: string
    readonly step: string
}

/** How a param is bound: to a value an earlier step, the inputs or the lead give at run time (`= steps.order.output.id`), or fixed. */
export type StepBinding = { readonly kind: "ref"; readonly ref: string } | { readonly kind: "fixed"; readonly value: string }

/** One choice of the output picker: a ref, its words and the group (the step, the inputs, the customer) it is listed under. */
export interface StepRefOptionView {
    readonly id: string
    readonly label: string
    readonly group: string
}

/**
 * One data param of a step as the drawer draws it: its words and type, and its binding, a ref drawn as a pink chip `= order.id`, a
 * fixed value drawn plain; the picker offers the refs that fit its type.
 */
export interface StepBindingView {
    /** The param, or `inputs.<name>` / `outputs.<name>` for a hand-off's input or an outcome's output. */
    readonly name: string
    readonly label: string
    readonly typeLabel: string
    readonly required: boolean
    readonly kind: "ref" | "fixed" | "empty"
    /** `= <ref>` for a ref, the value for a fixed one, empty when unbound. */
    readonly text: string
    /** The ref it is bound to, or null. */
    readonly ref: string | null
    readonly options: ReadonlyArray<StepRefOptionView>
    /** Why it cannot be saved, in the owner's words; empty when it can. */
    readonly error: string
}

/** One input (trigger) of the workflow as the trigger step's drawer draws it. */
export interface StepTriggerView {
    readonly key: string
    /** The source kind, the value of the source select. */
    readonly source: string
    readonly sourceOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly conditions: ReadonlyArray<string>
    /** The params it supplies, as chips. */
    readonly params: ReadonlyArray<{ readonly name: string; readonly label: string }>
    /** Why this input cannot be saved, in the owner's words; empty when it can. */
    readonly error: string
}

/** The target of an end hand-off as its drawer edits it. */
export interface StepCallView {
    /** `<agent>.<workflow>`, the value of the target select. */
    readonly target: string
    readonly targetLabel: string
    readonly targetOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly versionLabel: string
    readonly error: string
}

/** The picker of a new step's kind. */
export interface StepPickerView {
    readonly isOpen: boolean
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string; readonly description: string }>
}

/** The one mode control of the open step: how the node's calls run (rights.md: ONE mode per node, `auto | ask`, declared by the node). */
export interface StepModeView {
    readonly title: string
    readonly hint: string
    readonly label: string
    /** The node's mode. */
    readonly value: NodeRightMode
    readonly options: { readonly auto: string; readonly ask: string }
}

/** One account entry of the open step: its name and provider line, in the order the node tries them. */
export interface StepAccountView {
    /** The position of the entry in the node's `accounts`. */
    readonly index: number
    readonly name: string
    readonly line: string
}

/** One row of what the step can really do. */
export interface StepEffectiveRowView {
    readonly id: string
    readonly title: string
    /** The chip: the node's mode when the agent holds the account ("no mode declared" for a node that declares none), a not-attached line when it does not. */
    readonly chip: string
    readonly isNone: boolean
}

/** The mode and accounts sections of the open step's panel and the read-only effective rights beside them. */
export interface StepAccountsView {
    readonly sectionTitle: string
    readonly sectionHint: string
    /** The node's one mode; null where the node declares none. */
    readonly mode: StepModeView | null
    /** Said when the node acts through providers but declares no mode (a graph stored before every node declared one); null otherwise. */
    readonly modeNote: string | null
    readonly accounts: ReadonlyArray<StepAccountView>
    /** Said when the step uses no account (no provider). */
    readonly noProvider: string
    /** The attached accounts the step does not use yet: what add provider offers. */
    readonly addOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly addLabel: string
    /** the count of attached accounts (N from the API). */
    readonly addHint: string
    readonly removeLabel: string
    readonly effectiveTitle: string
    readonly effectiveHint: string
    readonly effective: ReadonlyArray<StepEffectiveRowView>
    readonly isReadOnly: boolean
}

/** The panel's slot with what a slot needs to draw. */
export interface StepAccountsSlotView {
    readonly slot: DataSlot<StepAccountsView>
    readonly placeholder: StepAccountsView
    readonly labels: SlotLabels
    readonly retry: () => void
}

/** The drawer of one step: its title and line, the form of its settings, its branches, and what saving does. */
export interface StepDrawerView {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly fieldsTitle: string
    readonly fields: ReadonlyArray<StepFieldView>
    readonly branchesTitle: string
    readonly branches: ReadonlyArray<StepBranchView>
    /** The data params of the step with their bindings, and their group's label. */
    readonly bindingsTitle: string
    readonly bindings: ReadonlyArray<StepBindingView>
    /** What the step answers (its outputs, typed), which later steps bind to. */
    readonly outputsTitle: string
    readonly outputs: ReadonlyArray<{ readonly name: string; readonly label: string; readonly typeLabel: string }>
    /** The inputs of the workflow, on the trigger step's drawer; empty on any other. */
    readonly triggersTitle: string
    readonly triggers: ReadonlyArray<StepTriggerView>
    /** The target of an end hand-off; null on any other step. */
    readonly call: StepCallView | null
    /** The words of the picker, the fixed-value field and the chip labels. */
    readonly pickerTitle: string
    readonly picker: StepPickerView
    readonly refLabel: string
    readonly fixedLabel: string
    readonly sourceLabel: string
    readonly conditionsLabel: string
    readonly paramsLabel: string
    readonly targetLabel: string
    readonly noConditions: string
    /** The key of the open step, which the drawer's own actions name. */
    readonly openKey: string
    /** The words of the picker's row command. */
    readonly pickLabel: string
    /** Said when the step has no setting to show. */
    readonly emptyNote: string
    /** The params a run used: read only, no footer. */
    readonly isReadOnly: boolean
    readonly readOnlyNote: string
    readonly closeLabel: string
    readonly cancelLabel: string
    /** "Save as version N" in the reader's language. */
    readonly saveLabel: string
    /** Saving is possible: something changed and every value is valid. */
    readonly canSave: boolean
    readonly isSaving: boolean
    readonly errorTitle: string
    /** What the back end said when it refused the save; empty otherwise. */
    readonly error: string
    /** The accounts the step may call (node rights); absent where the drawer has no agent to choose among. */
    readonly accounts?: StepAccountsSlotView
}

/** What a person does with the step drawer: open a step, close it, change a setting, save. */
export type StepAction =
    | { readonly kind: "open"; readonly nodeKey: string }
    | { readonly kind: "close" }
    | { readonly kind: "change"; readonly name: string; readonly value: StepFieldValue }
    | { readonly kind: "save" }
    /** A new step after `afterKey` (the trigger for the first): with `step` it is inserted at once, else the picker opens first. */
    | { readonly kind: "add"; readonly afterKey: string; readonly step?: string }
    /** The answer of the picker: the node kind of the new step. */
    | { readonly kind: "pick-step"; readonly step: string }
    /** A data param of the open step bound to a ref or a fixed value. */
    | { readonly kind: "bind"; readonly name: string; readonly binding: StepBinding }
    /** The source of one input of the workflow (on the trigger step). */
    | { readonly kind: "set-source"; readonly triggerKey: string; readonly source: string }
    /** The target of the open hand-off, `<agent>.<workflow>`. */
    | { readonly kind: "set-call"; readonly target: string }
    /** An attached account joins the step (the account's connection id). */
    | { readonly kind: "account-add"; readonly connectionId: string }
    /** An account entry leaves the step. */
    | { readonly kind: "account-remove"; readonly index: number }
    /** The node's one mode changed. */
    | { readonly kind: "node-mode"; readonly mode: NodeRightMode }
