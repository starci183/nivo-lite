"use client"

import { useFormatter, useTranslations } from "next-intl"
import { GUIDES } from "@/hooks/connection-guides"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf, guideScreensOf, useCopyLabels, verifyHelpOf } from "@/hooks/connection-wizard"
import { bankOptions, MONEY_STEPS, useMoneyWizard } from "@/hooks/money-wizard"
import type { AccountForm } from "@/hooks/money-wizard"
import { writeMoneyResume } from "@/modules/api/channel-connections/write-money-resume"
import { writeMoneyStart } from "@/modules/api/channel-connections/write-money-start"
import { writeMoneyUpdate } from "@/modules/api/channel-connections/write-money-update"
import { writeProviderKeys } from "@/modules/api/channel-connections/write-provider-keys"
import { writeConnectionAgents } from "@/modules/api/connections/write-connection-agents"
import { writeFirstEvent } from "@/modules/api/connections/write-first-event"
import type { AgentOption, FirstEvent, MoneyProvider } from "@/modules/types"
import { MoneyWizardBase } from "./component"

/** What the board hands the bank and payment wizard. */
interface MoneyWizardProps {
    readonly workspaceId: string
    readonly provider: MoneyProvider
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId?: string
    /** The workspace agents that can read bank feeds. */
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The fields of an account form as the api names them. */
const accountBody = (form: AccountForm) => ({
    environment: form.environment,
    name: form.name,
    bankCode: form.bank,
    accountNumber: form.account,
    holder: form.holder,
})

/** The guided setup for a bank or payment provider (SePay, payOS, Casso), driven by the provider registry. */
export const MoneyWizard = (props: MoneyWizardProps) => {
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const format = useFormatter()
    const copy = useCopyLabels()
    const { workspaceId } = props
    const wizard = useMoneyWizard({
        provider: props.provider,
        resumeId: props.resumeId,
        agents: props.agents,
        onClose: props.onClose,
        actions: {
            start: (provider, form) => writeMoneyStart({ workspaceId, provider, ...accountBody(form) }),
            update: (connectionId, form, apiKey) =>
                writeMoneyUpdate({
                    workspaceId,
                    connectionId,
                    ...accountBody(form),
                    ...(apiKey === undefined ? {} : { apiKey }),
                }),
            resume: (connectionId) => writeMoneyResume({ workspaceId, connectionId }),
            saveKeys: (connectionId, values) => writeProviderKeys({ workspaceId, connectionId, values }),
            setAgents: (connectionId, agents) => writeConnectionAgents({ workspaceId, connectionId, agents }),
            checkFirstEvent: (connectionId) => writeFirstEvent({ workspaceId, connectionId }),
        },
    })
    const def = PROVIDERS[props.provider]
    const { form, follow, conn, flags } = wizard
    const drafts =
        props.provider === "sepay"
            ? { webhookName: follow.webhookName, apiKey: follow.apiKey }
            : { webhookName: follow.webhookName }
    const receivedOf = (event: FirstEvent | null): string | null => {
        if (event === null) return null
        const amount = format.number(event.amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
        return event.content === ""
            ? tw("verifyReceivedNoContent", { amount })
            : tw("verifyReceived", { amount, content: event.content })
    }
    const keysNote = !flags.needsKeys ? null : tw(follow.keysSaved ? "keysSaved" : "keysHint")
    return (
        <MoneyWizardBase
            props={{
                title: tw("title", { provider: tc(providerKey(props.provider, "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: MONEY_STEPS.length }),
                steps: [
                    tw("stepEnv"),
                    tw("stepAccount"),
                    tw("stepFollow", { brand: def.brand }),
                    tw("stepVerify"),
                    tw("stepAgent"),
                ],
                index: wizard.index,
                step: wizard.step,
                waiting: wizard.isLoading ? tw("verifyWaiting") : null,
                earlyAccess: def.earlyAccess === true,
                environments: def.environments.map((environment) => ({
                    value: environment,
                    label: environment === "test" ? tw("envTest") : tw("envLive"),
                    description: environment === "test" ? tw("envTestBody", { brand: def.brand }) : tw("envLiveBody"),
                })),
                environment: form.environment,
                showEnvHint: def.environments.includes("test"),
                noTestNote: def.hasNoTestNote === true ? tc(providerKey(props.provider, "noTest")) : null,
                isLocked: conn !== null,
                isTest: form.environment === "test",
                needsBank: def.needsBank,
                bankOptions: bankOptions(),
                form,
                accountHint:
                    conn !== null && conn.account !== "" ? tw("accountKeep", { account: conn.account }) : undefined,
                providerHref: def.dashboard[form.environment] ?? null,
                screens: guideScreensOf(
                    {
                        provider: props.provider,
                        brand: def.brand,
                        steps: GUIDES[props.provider] ?? [],
                        ctx: wizard.context,
                        values: follow.values,
                        drafts,
                    },
                    tc,
                    tw,
                ),
                copy,
                followLabel: flags.keysDone ? tw("guideDone") : tw("saveKeys"),
                canFollow: !(flags.needsKeys && !flags.keysFilled && !follow.keysSaved),
                keysNote,
                verifyHelp: verifyHelpOf(props.provider, form.environment, wizard.context, tc),
                received: wizard.received ? receivedOf(wizard.firstEvent) : null,
                hasCheckFailed: wizard.hasCheckFailed,
                agentStep: {
                    title: tw("agentTitleAccounting"),
                    notice: wizard.hasSkipped && !wizard.received ? tw("skipNote") : null,
                    agents: agentChoicesOf(props.agents, props.provider, tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                note: wizard.note,
                isPending: wizard.isPending,
                text: {
                    back: tw("back"),
                    next: tw("next"),
                    close: tw("close"),
                    done: tw("done"),
                    skip: tw("skip"),
                    earlyAccess: tw("earlyAccess"),
                    earlyAccessNote: tw("earlyAccessNote"),
                    envHint: tw("envHint"),
                    envBadge: tw("envBadgeTest"),
                    openProvider: tw("openProvider", { brand: def.brand }),
                    fieldName: tw("fieldName"),
                    fieldNameHint: tw("fieldNameHint"),
                    fieldBank: tw("fieldBank"),
                    fieldBankPlaceholder: tw("fieldBankPlaceholder"),
                    fieldAccount: tw("fieldAccount"),
                    fieldHolder: tw("fieldHolder"),
                    createdLocked: tw("createdLocked"),
                    verifyWaiting: tw("verifyWaiting"),
                    verifyError: tw("verifyError"),
                },
            }}
            on={wizard.on}
        />
    )
}
