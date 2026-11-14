"use client"

import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { type GraphView } from "@/modules/plugin-registry"
import type { FlowGraphChip } from "@starci/grammar/common"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { mapSlot } from "@/hooks/slot"
import { useMutatePublishAgentWorkflowVersionSwr } from "@/hooks/swr"
import { WORKFLOW_STEP_PARAM } from "@/modules/routes"
import { toast } from "@/modules/toast"
import {
    accountChipsOf,
    changesOf,
    stepAccountsViewOf,
    withAccountAdded,
    withAccountRemoved,
    withNodeMode,
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
    type StepForm,
    type StepWords,
} from "@/modules/workflowSteps"
import type {
    AgentRightAccountView,
    StepAccountsSlotView,
    StepAction,
    StepDrawerView,
    StepsMapView,
} from "@/modules/types"
import { useStepAccounts } from "./useStepAccounts"

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
        const road = async (): Promise<void> => {
            await publish.trigger({
                installationId,
                workflowId: workflow.id,
                graphJson: JSON.stringify(
                    Object.keys(changes).length === 0 ? working : patchedSpecOf(working, state.openKey, changes),
                ),
                note: t("saveNote", { step: title }),
                expectedLatest: workflow.latestNumber,
            })
            toast.success(t("savedTitle"), { description: t("saved", { number: workflow.latestNumber + 1 }) })
            setState(() => SHUT)
            await onSaved?.()
        }
        void road().catch((error: unknown) =>
            setState((current) => ({ ...current, error: messageOf(error, t("saveFailed")) })),
        )
    }, [graph, map.nodes, state, workflow, spec, publish, installationId, t, onSaved, setState])
    return { run, isSaving: publish.isMutating }
}

/** A spec with the key of the step to open. */
interface OpenedSpec {
    readonly spec: GraphSpec
    readonly key: string
}

/** The state after a structural edit of the drawer: a new step (opened), a binding, a source, a target. */
const editedState = (current: StepState, spec: GraphSpec, action: StepAction): StepState => {
    const opened = (next: OpenedSpec): StepState => ({
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
        case "account-add":
        case "account-remove":
        case "change":
        case "close":
        case "node-mode":
        case "open":
        case "save":
            return current
    }
}

/** The state after an edit of the open step's rights (the node's mode, an account joining or leaving); anything else is left as it is. */
const accountEditedState = (
    current: StepState,
    spec: GraphSpec,
    action: StepAction,
    attached: ReadonlyArray<AgentRightAccountView> | undefined,
): StepState => {
    const draft = (next: GraphSpec): StepState => ({ ...current, draft: next })
    switch (action.kind) {
        case "account-add": {
            const account = attached?.find((one) => one.connectionId === action.connectionId)
            return account === undefined ? current : draft(withAccountAdded(spec, current.openKey, account))
        }
        case "account-remove":
            return draft(withAccountRemoved(spec, current.openKey, action.index))
        case "node-mode":
            return draft(withNodeMode(spec, current.openKey, action.mode))
        case "add":
        case "bind":
        case "change":
        case "close":
        case "open":
        case "pick-step":
        case "save":
        case "set-call":
        case "set-source":
            return current
    }
}

/** The loading shape of the accounts section: its real titles, one row. */
const placeholderGroup = { index: 0, name: "-", line: "-" }

/** The key of the step the address names (`?step=<node>`), or an empty string. */
const useWantedStep = (): string => useSearchParams().get(WORKFLOW_STEP_PARAM) ?? ""

/**
 * The card map of a workflow and the drawer of its steps: pressing a step opens its settings as a form; saving writes the next version
 * of that workflow. A refusal (a newer version) stays in the drawer in the back end's words. `?step=<node>` opens that step.
 */
export const useWorkflowSteps = (input: WorkflowStepsInput): WorkflowSteps => {
    const locale = stepsLocaleOf(useLocale())
    const [state, setState] = useState<StepState>(SHUT)
    const read = useMemo(() => specOf(input.graph), [input.graph])
    const spec = state.draft ?? read
    const graph = useMemo(() => graphOfSpec(spec, locale), [spec, locale])
    const accounts = useStepAccounts(input.installationId)
    const { attached, words: accountWords } = accounts
    const baseMap = useMemo(() => stepsMapOf(graph, locale), [graph, locale])
    // Each card's accounts as chips: the signature keeps the map the same object while nothing on the cards changed.
    const chips: Readonly<Record<string, ReadonlyArray<FlowGraphChip>>> =
        attached === undefined
            ? {}
            : Object.fromEntries(
                  graph.nodes.map((node) => [node.id, accountChipsOf(spec, node.id, attached, accountWords)]),
              )
    const chipsKey = JSON.stringify(chips)
    const map = useMemo<StepsMapView>(() => {
        const own = JSON.parse(chipsKey) as Record<string, ReadonlyArray<FlowGraphChip>>
        return {
            ...baseMap,
            nodes: baseMap.nodes.map((node) => {
                const added = own[node.id] ?? []
                return added.length === 0 ? node : { ...node, chips: [...(node.chips ?? []), ...added] }
            }),
        }
    }, [baseMap, chipsKey])
    const words = useStepWords(input.isReadOnly === true)
    const save = useStepSave({ input, spec: read, graph, map, state, setState })
    const wanted = useWantedStep()
    const opened = useRef("")
    useEffect(() => {
        const node = graph.nodes.find((one) => one.id === wanted)
        if (wanted === "" || node === undefined || opened.current === wanted) return
        opened.current = wanted
        setState((current) => ({ ...current, openKey: wanted, form: formOfNode(node), error: "", picking: null }))
    }, [wanted, graph])
    const nextNumber = (input.workflow?.latestNumber ?? 0) + 1
    const base = stepDrawerOf(
        {
            spec,
            isPicking: state.picking !== null,
            isEdited: state.draft !== null && JSON.stringify(state.draft) !== JSON.stringify(read),
            graph,
            map,
            nodeKey: state.openKey,
            form: state.form,
            isReadOnly: input.isReadOnly === true || input.workflow === null,
            nextNumber,
            isSaving: save.isSaving,
            error: state.error,
        },
        words,
    )
    const hasStep = spec?.nodes.some((node) => node.key === state.openKey) === true
    const accountsView: StepAccountsSlotView | undefined =
        accounts.isKnown && hasStep
            ? {
                  slot: mapSlot(accounts.slot, (list) =>
                      stepAccountsViewOf(spec, state.openKey, list, accountWords, base.isReadOnly),
                  ),
                  placeholder: {
                      ...stepAccountsViewOf(spec, state.openKey, [], accountWords, true),
                      accounts: [placeholderGroup],
                  },
                  labels: accounts.slotLabels,
                  retry: accounts.retry,
              }
            : undefined
    const drawer: StepDrawerView = {
        ...base,
        ...(accountsView === undefined ? {} : { accounts: accountsView }),
    }
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
                return setState((current) => ({
                    ...current,
                    openKey: action.nodeKey,
                    form: formOfNode(node),
                    error: "",
                    picking: null,
                }))
            }
            if (spec === null || input.isReadOnly === true) return undefined
            if (action.kind.startsWith("account-") || action.kind === "node-mode")
                return setState((current) => accountEditedState(current, spec, action, attached))
            return setState((current) => editedState(current, spec, action))
        },
    }
}
