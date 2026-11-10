"use client"

import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { GraphView } from "@nivo-lite/blocks-core/graph"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { useMutatePublishAgentWorkflowVersionSwr } from "@/hooks/swr"
import { toast } from "@/modules/toast"
import {
    changesOf,
    formOfNode,
    graphOfSpec,
    patchedSpecOf,
    specOf,
    stepDrawerOf,
    stepsLocaleOf,
    stepsMapOf,
    withBinding,
    withCallTarget,
    withSource,
    withStepAfter,
} from "@/modules/workflowSteps"
import type { StepForm, StepWords } from "@/modules/workflowSteps"
import type { StepAction, StepDrawerView, StepsMapView } from "@/modules/types"

/** The workflow a save writes to: its id and the newest version number the page read. */
interface StepsWorkflow {
    readonly id: string
    readonly latestNumber: number
}

/** What the card map of a workflow is drawn from and where its saves go. */
interface WorkflowStepsInput {
    readonly installationId: string
    /** The graph: JSON text (a workflow version) or a parsed document (the flow of the agent graph); null while unread. */
    readonly graph: unknown
    /** The workflow a save writes a new version of; null when there is none (the drawer still opens, read only). */
    readonly workflow: StepsWorkflow | null
    /** True for the drawer of a run: the settings the run used, never saved. */
    readonly isReadOnly?: boolean
    /** Reads the workflow (and anything drawn from it) again after a save. */
    readonly onSaved?: () => Promise<unknown>
}

/** The card map, the step whose drawer is open, the drawer and what a person does with it. */
export interface WorkflowSteps {
    readonly map: StepsMapView
    readonly selectedId: string | null
    readonly drawer: StepDrawerView
    readonly act: (action: StepAction) => void
}

/** Where the picker of a new step's kind puts the step it picks: after a step. */
type Picking = { readonly afterKey: string }

/** The open step, the form of its settings, the graph as edited so far, the open picker and the refusal of the last save. */
interface StepState {
    readonly openKey: string
    readonly form: StepForm
    readonly error: string
    /** The graph with the drawer's structural edits (a step, a branch, a binding, a source, a target); null while nothing changed. */
    readonly draft: GraphSpec | null
    readonly picking: Picking | null
}

const SHUT: StepState = { openKey: "", form: {}, error: "", draft: null, picking: null }

/** The message of a refused save as the back end wrote it (already in the reader's language), else the fallback. */
const messageOf = (error: unknown, fallback: string): string =>
    error instanceof Error && error.message !== "" ? error.message : fallback

/** The words of the drawer, every one read from the catalog here, numbers through the app's formatter. */
const useStepWords = (isRun: boolean): StepWords => {
    const t = useTranslations("workflowSteps")
    const locale = stepsLocaleOf(useLocale())
    const format = useFormatter()
    return useMemo(
        () => ({
            locale,
            fieldsTitle: t("fieldsTitle"),
            branchesTitle: t("branchesTitle"),
            bindingsTitle: t("bindingsTitle"),
            outputsTitle: t("outputsTitle"),
            triggersTitle: t("triggersTitle"),
            pickerTitle: t("pickerTitle"),
            refLabel: t("refLabel"),
            fixedLabel: t("fixedLabel"),
            sourceLabel: t("sourceLabel"),
            conditionsLabel: t("conditionsLabel"),
            paramsLabel: t("paramsLabel"),
            targetLabel: t("targetLabel"),
            noConditions: t("noConditions"),
            pickLabel: t("pick"),
            emptyNote: t("noParams"),
            readOnlyNote: isRun ? t("readOnly") : t("noWorkflow"),
            closeLabel: t("close"),
            cancelLabel: t("cancel"),
            errorTitle: t("errorTitle"),
            required: t("required"),
            save: (number) => t("save", { number }),
            min: (min) => t("min", { min }),
            max: (max) => t("max", { max }),
            range: (min, max) => t("range", { min, max }),
            number: (value, input, unit) => {
                if (input === "money")
                    return format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
                return unit === undefined
                    ? format.number(value)
                    : format.number(value, { style: "unit", unit, unitDisplay: "long" })
            },
        }),
        [t, format, isRun, locale],
    )
}

/** What a save needs: the graph, its map, the workflow and the state of the drawer. */
interface StepSaveInput {
    readonly input: WorkflowStepsInput
    readonly spec: GraphSpec | null
    readonly graph: GraphView
    readonly map: StepsMapView
    readonly state: StepState
    readonly setState: (next: (current: StepState) => StepState) => void
}

/**
 * The save of the open step: the next version of THAT workflow with the step's settings changed (`publishAgentWorkflowVersion`,
 * `expectedLatest` the version read, the note naming the step), then the reads again; a refusal stays in the drawer.
 */
const useStepSave = (save: StepSaveInput): { readonly run: () => void; readonly isSaving: boolean } => {
    const t = useTranslations("workflowSteps")
    const publish = useMutatePublishAgentWorkflowVersionSwr()
    const { input, spec, graph, map, state, setState } = save
    const { workflow, installationId, onSaved } = input
    const run = useCallback(() => {
        const node = graph.nodes.find((entry) => entry.id === state.openKey)
        const changes = changesOf(node, state.form)
        const edited = state.draft !== null && JSON.stringify(state.draft) !== JSON.stringify(spec)
        if (workflow === null || spec === null || (Object.keys(changes).length === 0 && !edited)) return
        const working = state.draft ?? spec
        const title = map.nodes.find((entry) => entry.id === state.openKey)?.label ?? node?.label ?? ""
        setState((current) => ({ ...current, error: "" }))
        void publish
            .trigger({
                installationId,
                workflowId: workflow.id,
                graphJson: JSON.stringify(
                    Object.keys(changes).length === 0 ? working : patchedSpecOf(working, state.openKey, changes),
                ),
                note: t("saveNote", { step: title }),
                expectedLatest: workflow.latestNumber,
            })
            .then(async () => {
                toast.success(t("savedTitle"), { description: t("saved", { number: workflow.latestNumber + 1 }) })
                setState(() => SHUT)
                await onSaved?.()
            })
            .catch((failure: unknown) =>
                setState((current) => ({ ...current, error: messageOf(failure, t("saveFailed")) })),
            )
    }, [graph, map.nodes, state, workflow, spec, publish, installationId, t, onSaved, setState])
    return { run, isSaving: publish.isMutating }
}

/** The state after a structural edit of the drawer: a new step (opened), a binding, a source, a target. */
const editedState = (current: StepState, spec: GraphSpec, action: StepAction): StepState => {
    const opened = (next: { readonly spec: GraphSpec; readonly key: string }): StepState => ({
        ...current,
        draft: next.spec,
        openKey: next.key,
        form: {},
        error: "",
        picking: null,
    })
    switch (action.kind) {
        case "add":
            return action.step === undefined
                ? { ...current, picking: { afterKey: action.afterKey } }
                : opened(withStepAfter(spec, action.afterKey, action.step))
        case "pick-step": {
            const picking = current.picking
            if (picking === null) return current
            return opened(withStepAfter(spec, picking.afterKey, action.step))
        }
        case "bind":
            return { ...current, draft: withBinding(spec, current.openKey, action.name, action.binding) }
        case "set-source":
            return { ...current, draft: withSource(spec, action.triggerKey, action.source) }
        case "set-call":
            return { ...current, draft: withCallTarget(spec, current.openKey, action.target) }
        default:
            return current
    }
}

/**
 * The card map of a workflow and the drawer of its steps: pressing a step opens its settings as a form; saving writes the next version
 * of that workflow. A refusal (a newer version, a change that widens the agent's rights for a manager) stays in the drawer in the
 * back end's words.
 */
export const useWorkflowSteps = (input: WorkflowStepsInput): WorkflowSteps => {
    const locale = stepsLocaleOf(useLocale())
    const [state, setState] = useState<StepState>(SHUT)
    const read = useMemo(() => specOf(input.graph), [input.graph])
    const spec = state.draft ?? read
    const graph = useMemo(() => graphOfSpec(spec, locale), [spec, locale])
    const map = useMemo(() => stepsMapOf(graph, locale), [graph, locale])
    const words = useStepWords(input.isReadOnly === true)
    const save = useStepSave({ input, spec: read, graph, map, state, setState })
    const drawer = stepDrawerOf(
        {
            spec,
            isPicking: state.picking !== null,
            isEdited: state.draft !== null && JSON.stringify(state.draft) !== JSON.stringify(read),
            graph,
            map,
            nodeKey: state.openKey,
            form: state.form,
            isReadOnly: input.isReadOnly === true || input.workflow === null,
            nextNumber: (input.workflow?.latestNumber ?? 0) + 1,
            isSaving: save.isSaving,
            error: state.error,
        },
        words,
    )
    return {
        map,
        selectedId: state.openKey === "" ? null : state.openKey,
        drawer,
        act: (action) => {
            if (action.kind === "save") return save.run()
            if (action.kind === "close") return setState(SHUT)
            if (action.kind === "change")
                return setState((current) => ({ ...current, form: { ...current.form, [action.name]: action.value } }))
            if (action.kind === "open") {
                const node = graph.nodes.find((one) => one.id === action.nodeKey)
                return setState((current) => ({ ...current, openKey: action.nodeKey, form: formOfNode(node), error: "", picking: null }))
            }
            if (spec === null || input.isReadOnly === true) return undefined
            return setState((current) => editedState(current, spec, action))
        },
    }
}
