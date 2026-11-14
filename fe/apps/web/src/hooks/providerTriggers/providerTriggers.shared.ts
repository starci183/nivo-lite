import type { useQueryProviderTriggerStatesSwr } from "@/hooks/swr"
import type {
    DataSlot,
    ProviderRightHoldersView,
    ProviderTriggerCardView,
    ProviderTriggerDeciderView,
    ProviderTriggerRowView,
    ProviderTriggerWorkflowView,
} from "@/modules/types"
import { registryWordsOf } from "@/hooks/providerOffer"

/** One trigger's row as the back end answers it (the read and both mutations answer this shape). */
export type ProviderTriggerState = Exclude<ReturnType<typeof useQueryProviderTriggerStatesSwr>["data"], undefined>[number]

/** What the mapper needs of the reader's language: the locale and the worded formats. */
export interface ProviderTriggerWords {
    readonly locale: string
    /** "Last fired {when} · {count} times". */
    readonly fired: (when: string, count: number) => string
    /** The time of a fire in the reader's language, from an ISO instant. */
    readonly when: (iso: string) => string
    /** The word of a trigger's kind ("webhook" | "poll"); any other kind shows as given. */
    readonly kind: (kind: string) => string
    /** "Never fired yet". */
    readonly neverFired: string
}

/** The decider of one trigger: none, locked to the core agent, or a choice among the attached agents. */
const deciderOf = (state: ProviderTriggerState): ProviderTriggerDeciderView | null => {
    if (!state.decided) return null
    if (state.coreDecides) return { kind: "locked", agentName: state.deciderAgentName ?? "" }
    return {
        kind: "choice",
        agentId: state.deciderAgentId ?? null,
        options: state.deciderChoices.map((choice) => ({ id: choice.agentId, label: choice.name })),
    }
}

/** The two kinds' words. */
export interface ProviderTriggerKindWords {
    readonly webhook: string
    readonly poll: string
}

/** The word of a trigger's kind: webhook and poll are worded, any other kind shows as given. */
export const kindWordOf = (kind: string, words: ProviderTriggerKindWords): string => {
    if (kind === "webhook") return words.webhook
    return kind === "poll" ? words.poll : kind
}

/** The workflows a trigger wakes, from the account's rights read; none while that read has not answered. */
export const workflowsOfTrigger = (
    holders: DataSlot<ProviderRightHoldersView>,
    trigger: string,
): ReadonlyArray<ProviderTriggerWorkflowView> => {
    if (!("items" in holders)) return []
    const found = holders.items.triggers.find((one) => one.id === trigger)
    return (found?.holders ?? []).map((holder) => ({
        id: holder.id,
        name: holder.place?.workflowName ?? holder.chip,
        chip: holder.chip,
        href: holder.place?.href ?? null,
    }))
}

/** The row of one trigger: its switch, the registry's summary, its kind, its last fire, its workflows and its decider where it has one. */
const rowOf = (
    state: ProviderTriggerState,
    words: ProviderTriggerWords,
    workflows: ReadonlyArray<ProviderTriggerWorkflowView>,
): ProviderTriggerRowView => ({
    id: state.name,
    title: registryWordsOf(state.summary, words.locale) ?? state.name,
    isOn: state.enabled,
    canCatchUp: state.canCatchUp,
    kindLabel: words.kind(state.kind),
    fired:
        state.lastFiredAt === null
            ? words.neverFired
            : words.fired(words.when(state.lastFiredAt), state.firedCount),
    workflows,
    decider: deciderOf(state),
})

/** The Trigger card of one account from the trigger rows the API answered; the numbers and names are the API's. */
export const triggerCardOf = (
    states: ReadonlyArray<ProviderTriggerState>,
    catchUp: boolean,
    words: ProviderTriggerWords,
    workflowsOf: (trigger: string) => ReadonlyArray<ProviderTriggerWorkflowView>,
): ProviderTriggerCardView => ({
    rows: states.map((state) => rowOf(state, words, workflowsOf(state.name))),
    hasCatchUp: states.some((state) => state.canCatchUp),
    catchUp,
})

/** The same shape with no words: the card's skeleton keeps its ready tree (one trigger with a decider and a workflow). */
export const PROVIDER_TRIGGER_CARD_PLACEHOLDER: ProviderTriggerCardView = {
    rows: [
        {
            id: "-",
            title: "-",
            isOn: false,
            canCatchUp: true,
            kindLabel: "-",
            fired: "-",
            workflows: [{ id: "-", name: "-", chip: "-", href: null }],
            decider: { kind: "choice", agentId: null, options: [] },
        },
    ],
    hasCatchUp: true,
    catchUp: false,
}

/** The message key (inside `providerPage`) of each refusal code the trigger operations answer; any other code shows the back end's own words. */
export const PROVIDER_TRIGGER_ERROR_KEYS: Readonly<Record<string, string>> = {
    PROVIDER_TRIGGERS_UNDECLARED: "triggerErrorUndeclared",
    PROVIDER_TRIGGERS_UNKNOWN_ACCOUNT: "triggerErrorUnknownAccount",
    PROVIDER_TRIGGERS_NOT_DECIDED: "triggerErrorNotDecided",
    PROVIDER_TRIGGERS_CORE_DECIDES: "triggerErrorCoreDecides",
    PROVIDER_TRIGGERS_NOT_ATTACHED: "triggerErrorNotAttached",
    WORKSPACE_MEMBERS_NOT_MEMBER: "triggerErrorNotMember",
    WORKSPACE_MEMBERS_ROLE_FORBIDDEN: "triggerErrorRoleForbidden",
}
