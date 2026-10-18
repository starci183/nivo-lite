import {
    type SetupWriteDraft as Draft,
    FACT_SCOPES,
    type FlowRuleMode,
    type SetupResolution,
    type SetupWrite,
    type SetupWriteDecision,
    type SetupWriteInstance,
    type SetupWriteProposal,
    type SetupWriteWords,
} from "@/modules/types"
import { useState } from "react"
import { SetupWriteView } from "@/components/leaves/SetupWriteView"

/** What the chat hands the card: the write, the words, the way to settle it and the instance the chat is for. */
type SetupWriteCardProps = {
    readonly write: SetupWrite
    readonly words: SetupWriteWords
    /** The card is being settled: its commands wait. */
    readonly isBusy: boolean
    /** Sends the decision of the owner. */
    readonly onDecide: (id: string, change: SetupWriteDecision) => void
    readonly instance: SetupWriteInstance | null
}

const MODES: ReadonlyArray<FlowRuleMode> = ["auto", "ask", "never"]
const RESOLUTIONS: ReadonlyArray<SetupResolution> = ["replace", "keep", "both"]
const FOR_ALL = "all"
const FOR_THIS = "this"

const startOf = (write: SetupWrite): Draft => ({
    isEditing: false,
    value: write.kind === "fact" ? write.payload.value : "",
    scope: write.kind === "fact" ? write.payload.scope : "internal",
    mode: write.kind === "rule" ? write.payload.mode : "ask",
    limit: write.kind === "rule" ? write.payload.limitVnd : null,
    resolution: "replace",
    situation: "",
    onlyThis: false,
})

const itemsOf = (write: SetupWrite, draft: Draft, forLabel: string, words: SetupWriteWords) => {
    if (write.kind === "fact") {
        return [
            { id: "subject", term: words.subject, description: write.payload.subjectLabel },
            { id: "attribute", term: words.attribute, description: write.payload.attributeLabel },
            ...(draft.isEditing ? [] : [{ id: "value", term: words.value, description: draft.value }]),
            ...(draft.isEditing
                ? []
                : [{ id: "scope", term: words.scope, description: words.scopeLabel(draft.scope) }]),
            ...(draft.isEditing || forLabel === "" ? [] : [{ id: "for", term: words.forLabel, description: forLabel }]),
        ]
    }
    const rules = words.actionRules(write.payload.action)
    const currentLimit = rules.hasLimit && write.current ? ` · ${words.money(write.current.limitVnd)}` : ""
    const inForce = write.current ? `${words.modeLabel(write.current.mode)}${currentLimit}` : words.nowNone
    return [
        { id: "action", term: words.action, description: words.actionLabel(write.payload.action) },
        ...(draft.isEditing ? [] : [{ id: "mode", term: words.mode, description: words.modeLabel(draft.mode) }]),
        ...(draft.isEditing || !rules.hasLimit
            ? []
            : [{ id: "limit", term: words.limit, description: words.money(draft.limit) }]),
        { id: "now", term: words.now, description: inForce },
    ]
}

/** One proposed write of the setup chat. The owner confirms (edited or not) before anything is written. */
export const SetupWriteCard = (props: SetupWriteCardProps) => {
    const { write, words, instance } = props
    const [draft, setDraft] = useState<Draft>(startOf(write))
    const patch = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }))
    const rules = write.kind === "rule" ? words.actionRules(write.payload.action) : null
    const decide = (change: SetupWriteDecision) => props.onDecide(write.id, change)
    // The value in force is the shared one: a value kept for this instance only sits beside it and never conflicts with it.
    const isConflict =
        write.kind === "fact" &&
        !draft.onlyThis &&
        write.current !== null &&
        !words.isSameValue(write.current.value, draft.value)
    const forAllLabel = instance === null ? "" : words.forAll(instance.typeName)
    const forThisLabel = instance === null ? "" : words.forThis(instance.name)
    const confirm = () => {
        if (write.kind === "fact") {
            decide({
                decision: "confirm",
                fact: { value: draft.value, scope: draft.scope },
                resolution: isConflict ? draft.resolution : undefined,
                situation: draft.resolution === "both" ? draft.situation : undefined,
                onlyThisAgent: instance !== null && draft.onlyThis,
            })
            return
        }
        decide({ decision: "confirm", rule: { mode: draft.mode, limitVnd: rules?.hasLimit ? draft.limit : null } })
    }
    return (
        <SetupWriteView
            props={{
                decided: words.decidedOf(write),
                proposal: proposalOf(props, draft, isConflict, forAllLabel, forThisLabel, rules),
            }}
            on={{
                value: (value) => patch({ value }),
                scope: (value) => patch({ scope: FACT_SCOPES.find((scope) => scope === value) ?? "internal" }),
                forWho: (value) => patch({ onlyThis: value === FOR_THIS }),
                mode: (value) => patch({ mode: MODES.find((mode) => mode === value) ?? "ask" }),
                limit: (value) => patch({ limit: Number.isFinite(value) ? value : null }),
                resolution: (value) =>
                    patch({ resolution: RESOLUTIONS.find((resolution) => resolution === value) ?? "replace" }),
                situation: (situation) => patch({ situation }),
                confirm,
                toggleEdit: () => patch({ isEditing: !draft.isEditing }),
                reject: () => decide({ decision: "reject" }),
            }}
        />
    )
}

/** Resolves the proposal fields and choices from the current draft. */
const proposalOf = (
    props: SetupWriteCardProps,
    draft: Draft,
    isConflict: boolean,
    forAllLabel: string,
    forThisLabel: string,
    rules: ReturnType<SetupWriteWords["actionRules"]> | null,
): SetupWriteProposal => {
    const { write, words, instance } = props
    const resolutionLabels = { replace: words.replace, keep: words.keep, both: words.both }
    return {
        id: write.id,
        head: write.kind === "fact" ? words.factTitle : words.ruleTitle,
        isFact: write.kind === "fact",
        hasGap: write.kind === "fact" && Boolean(write.payload.gapId),
        gapLabel: words.gap,
        items: itemsOf(write, draft, draft.onlyThis ? forThisLabel : forAllLabel, words),
        sharedNote: write.kind === "rule" && instance !== null ? words.ruleShared(instance.typeName) : "",
        isEditing: draft.isEditing,
        valueLabel: words.value,
        value: draft.value,
        scopeLabel: words.scope,
        scope: draft.scope,
        scopeOptions: FACT_SCOPES.map((scope) => ({ value: scope, label: words.scopeLabel(scope) })),
        forLabel: words.forLabel,
        forValue: draft.onlyThis ? FOR_THIS : FOR_ALL,
        forOptions:
            instance === null
                ? []
                : [
                      { value: FOR_ALL, label: forAllLabel },
                      { value: FOR_THIS, label: forThisLabel },
                  ],
        modeLabel: words.mode,
        mode: draft.mode,
        modeOptions: MODES.filter((mode) => mode !== "auto" || rules?.allowsAuto === true).map((mode) => ({
            value: mode,
            label: words.modeLabel(mode),
        })),
        hasLimit: rules?.hasLimit === true,
        limitLabel: words.limit,
        limit: draft.limit ?? undefined,
        isLimitDisabled: draft.mode === "never",
        isConflict,
        conflictTitle: words.conflictTitle,
        conflictBody: words.conflictBody(write.kind === "fact" ? (write.current?.value ?? "") : ""),
        resolution: draft.resolution,
        resolutionOptions: RESOLUTIONS.map((resolution) => ({
            value: resolution,
            label: resolutionLabels[resolution],
        })),
        situationLabel: words.situation,
        situation: draft.situation,
        confirmLabel: words.confirm,
        editLabel: draft.isEditing ? words.editDone : words.edit,
        rejectLabel: words.reject,
        canConfirm:
            write.kind === "rule" ||
            (draft.value.trim().length > 0 &&
                (draft.resolution !== "both" || !isConflict || draft.situation.trim().length > 0)),
        isPending: props.isBusy,
    }
}
