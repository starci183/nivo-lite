"use client"

import { useMoneyWizardActions } from "./useMoneyWizardActions"
import { viewOf } from "./money-wizard.shared"
import { PROVIDERS } from "@/hooks/connection-providers"
import { useSetConnectionAgents } from "@/hooks/connections"
import type { AgentOption, MoneyProvider } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useMoneyCommands } from "./useMoneyCommands"
import { useMoneyWizardState } from "./useMoneyWizardState"

/** What the bank and payment wizard needs from its drawer. */
export interface MoneyWizardInput {
    readonly provider: MoneyProvider
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId: string | undefined
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * The state machine of the guided setup for a bank or payment provider (SePay, payOS, Casso): environment, name and account,
 * "follow along on the provider", the wait for the first real webhook, attach to the agents. The connection is created (pending) when
 * the account step ends, so the URL and key exist for the follow-along step. Everything stays editable afterwards: the earlier steps
 * save on Next, and the follow-along step edits the webhook name and the SePay API key in place.
 */
export const useMoneyWizard = (input: MoneyWizardInput) => {
    const tw = useTranslations("connectionWizard")
    const commands = useMoneyCommands()
    const setAgentsOf = useSetConnectionAgents()
    const def = PROVIDERS[input.provider]
    const state = useMoneyWizardState(input, def)
    const { go, create, followDone, finish, isPending } = useMoneyWizardActions({
        setNote: state.setNote,
        setNav: state.setNav,
        conn: state.conn,
        commands,
        form: state.form,
        input,
        follow: state.follow,
        adopt: state.adopt,
        tw,
        def,
        flags: state.flags,
        setFollow: state.setFollow,
        setAgentsOf,
        agentIds: state.agentIds,
    })

    return viewOf({
        nav: state.nav,
        step: state.step,
        input,
        resume: state.resume,
        form: state.form,
        conn: state.conn,
        follow: state.follow,
        note: state.note,
        agentIds: state.agentIds,
        isPending,
        received: state.received,
        watch: state.watch,
        flags: state.flags,
        go,
        create,
        followDone,
        finish,
        setNote: state.setNote,
        setNav: state.setNav,
        setForm: state.setForm,
        setFollow: state.setFollow,
        setAgentIds: state.setAgentIds,
    })
}

/** The current money-connection step and whether verification was skipped. */
export type NavInput1 = { index: number; skipped: boolean }
