import type { FactScope } from "./brain"
import type { FlowRuleMode } from "./flow"

/** The instance whose chat this is, when its type allows several (one Chatbot per branch): a fact may be kept for this instance only. */
export interface SetupWriteInstance {
    readonly name: string
    readonly typeName: string
}

/** What a rule action allows. */
export interface SetupActionRules {
    /** The action carries an amount limit. */
    readonly hasLimit: boolean
    /** The action may run by itself; false when it must at least ask. */
    readonly allowsAuto: boolean
}

/** Every word and small formatter a confirm card of the setup chat needs, in the reader language. */
export interface SetupWriteWords {
    readonly factTitle: string
    readonly ruleTitle: string
    readonly gap: string
    readonly subject: string
    readonly attribute: string
    readonly value: string
    readonly scope: string
    readonly forLabel: string
    readonly action: string
    readonly mode: string
    readonly limit: string
    readonly now: string
    readonly nowNone: string
    readonly conflictTitle: string
    readonly situation: string
    readonly confirm: string
    readonly edit: string
    readonly editDone: string
    readonly reject: string
    readonly applied: string
    readonly appliedRule: string
    readonly rejected: string
    readonly kept: string
    readonly replace: string
    readonly keep: string
    readonly both: string
    readonly conflictBody: (current: string) => string
    readonly scopeLabel: (scope: FactScope) => string
    readonly modeLabel: (mode: FlowRuleMode) => string
    readonly money: (amount: number | null) => string
    readonly actionLabel: (action: string) => string
    readonly actionRules: (action: string) => SetupActionRules
    readonly forAll: (typeName: string) => string
    readonly forThis: (name: string) => string
    readonly ruleShared: (typeName: string) => string
    readonly isSameValue: (a: string, b: string) => boolean
}

/** One choice of a field of a confirm card. */
interface SetupWriteOption {
    readonly value: string
    readonly label: string
}

/** The facts of a card that was already decided: one line and how it ended. */
export interface SetupWriteDecided {
    readonly line: string
    readonly label: string
    readonly tone: "success" | "neutral"
}

/** The facts and fields of a card that waits for the owner. */
export interface SetupWriteProposal {
    readonly id: string
    readonly head: string
    readonly isFact: boolean
    readonly hasGap: boolean
    readonly gapLabel: string
    readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    readonly sharedNote: string
    readonly isEditing: boolean
    readonly valueLabel: string
    readonly value: string
    readonly scopeLabel: string
    readonly scope: string
    readonly scopeOptions: ReadonlyArray<SetupWriteOption>
    readonly forLabel: string
    readonly forValue: string
    readonly forOptions: ReadonlyArray<SetupWriteOption>
    readonly modeLabel: string
    readonly mode: string
    readonly modeOptions: ReadonlyArray<SetupWriteOption>
    readonly hasLimit: boolean
    readonly limitLabel: string
    readonly limit: number | undefined
    readonly isLimitDisabled: boolean
    readonly isConflict: boolean
    readonly conflictTitle: string
    readonly conflictBody: string
    readonly resolution: string
    readonly resolutionOptions: ReadonlyArray<SetupWriteOption>
    readonly situationLabel: string
    readonly situation: string
    readonly confirmLabel: string
    readonly editLabel: string
    readonly rejectLabel: string
    readonly canConfirm: boolean
    readonly isPending: boolean
}
