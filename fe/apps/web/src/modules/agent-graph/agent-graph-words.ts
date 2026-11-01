import type { useTranslations } from "next-intl"
import type { InstallationLifecycle } from "@/modules/installations"
import type {
    AgentGraphApproverData,
    AgentGraphSourceData,
    AgentGraphNodeKind,
    AgentGraphOnTimeout,
    AgentGraphThen,
} from "@/modules/types"

/** The translator of the graph copy. */
export type AgentGraphT = ReturnType<typeof useTranslations<"agentGraph">>

/** What the builders of the views know about the person and the language. */
export interface AgentGraphContext {
    readonly t: AgentGraphT
    /** Owners and managers edit the graph. */
    readonly canEdit: boolean
    /** Only the owner may add what widens the agent's reach. */
    readonly isOwner: boolean
    /** Writes an amount in dong as an owner says it: "5 million". */
    readonly amount: (vnd: number) => string
    /** An action key in the words every other screen says it, never the key. */
    readonly actionWord: (action: string) => string
    /** Where the checklist of the agent stands: the other half of what "Publish and run" does. */
    readonly setup: AgentGraphSetupState
    /** The names of the channels the agent is connected to. */
    readonly channels: ReadonlyArray<string>
    /** The one state of the agent (the lifecycle the back end names); null until it is read. */
    readonly lifecycle: InstallationLifecycle | null
    /** That state in words: the label every other screen shows for it. */
    readonly lifecycleLabel: string
}

/** The checklist of the setup as the one publish action sees it. */
export interface AgentGraphSetupState {
    /** Every item is confirmed. */
    readonly isReady: boolean
    /** The checklist differs from the version the agent runs on. */
    readonly isChanged: boolean
    /** How many items are not confirmed yet. */
    readonly missing: number
    /** The checklist is being applied. */
    readonly isApplying: boolean
}

/** The word of a node kind: the lane it sits in. */
export const kindWordOf = (t: AgentGraphT, kind: AgentGraphNodeKind): string => {
    const words: Readonly<Record<AgentGraphNodeKind, string>> = {
        trigger: t("kind_trigger"),
        execute: t("kind_execute"),
        condition: t("kind_condition"),
        output: t("kind_output"),
    }
    return words[kind]
}

/** The word of the rule behind a node: where it came from. */
export const sourceWordOf = (t: AgentGraphT, kind: AgentGraphSourceData["kind"]): string => {
    const words: Readonly<Record<AgentGraphSourceData["kind"], string>> = {
        brain: t("source_brain"),
        template: t("source_template"),
        chat: t("source_chat"),
        learned: t("source_learned"),
        owner: t("source_owner"),
        rule: t("source_rule"),
        corrected: t("source_corrected"),
    }
    return words[kind]
}

/** The word of what a branch does. */
export const thenWordOf = (t: AgentGraphT, then: AgentGraphThen): string => {
    const words: Readonly<Record<AgentGraphThen, string>> = {
        auto: t("then_auto"),
        ask: t("then_ask"),
        stop: t("then_stop"),
    }
    return words[then]
}

/** The word of what happens when nobody answers in time. */
export const timeoutWordOf = (t: AgentGraphT, kind: AgentGraphOnTimeout): string => {
    const words: Readonly<Record<AgentGraphOnTimeout, string>> = {
        backup: t("timeout_backup"),
        stop: t("timeout_stop"),
        agent_owner: t("timeout_owner"),
        unset: t("timeout_unset"),
    }
    return words[kind]
}

/** The line of the approver card: how long they have and who takes over. */
export const timeoutLineOf = (t: AgentGraphT, approver: AgentGraphApproverData): string => {
    const hours = Math.round(approver.timeoutMinutes / 60)
    if (approver.onTimeout === "backup") return t("timeoutLineBackup", { hours, name: approver.backupName })
    if (approver.onTimeout === "stop") return t("timeoutLineStop", { hours })
    if (approver.onTimeout === "agent_owner") return t("timeoutLineOwner", { hours })
    return t("timeoutLineUnset")
}

/** The word of a role of the workspace: who is asked when a branch names a role and not a person. */
export const roleWordOf = (t: AgentGraphT, role: string): string => {
    if (role === "owner") return t("role_owner")
    if (role === "manager") return t("role_manager")
    return role === "staff" ? t("role_staff") : role
}
