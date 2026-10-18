"use client"

import { useBankName } from "@/hooks/banks"
import { useFormatter, useTranslations } from "next-intl"
import { GUIDES } from "@/hooks/connection-guides"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf, guideScreensOf, useCopyLabels, verifyHelpOf } from "@/hooks/connection-wizard"
import { bankOptions, MONEY_STEPS, useMoneyWizard } from "@/hooks/money-wizard"
import type { AgentOption, FirstEvent, MoneyProvider } from "@/modules/types"
import { MoneyWizardBase } from "./component"

/** What the board hands the bank and payment wizard. */
interface MoneyWizardProps {
    readonly provider: MoneyProvider
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId?: string
    /** The workspace agents that can read bank feeds. */
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The guided setup for a bank or payment provider (SePay, payOS, Casso), driven by the provider registry. */
export const MoneyWizard = (props: MoneyWizardProps) => {
    const bankName = useBankName()
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const format = useFormatter()
    const copy = useCopyLabels()
    const wizard = useMoneyWizard({
        provider: props.provider,
        resumeId: props.resumeId,
        agents: props.agents,
        onClose: props.onClose,
    })
    const def = PROVIDERS[props.provider]
    const { form, follow, conn, flags } = wizard
    const keysNote = moneyKeysNote(flags.needsKeys, follow.keysSaved, tw)
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
                bankOptions: bankOptions(bankName),
                form,
                accountHint:
                    conn !== null && conn.account !== "" ? tw("accountKeep", { account: conn.account }) : undefined,
                providerHref: def.dashboard[form.environment] ?? null,
                screens: moneyGuideScreens(props.provider, wizard, tc, tw),
                copy,
                followLabel: flags.keysDone ? tw("guideDone") : tw("saveKeys"),
                canFollow: !(flags.needsKeys && !flags.keysFilled && !follow.keysSaved),
                keysNote,
                verifyHelp: verifyHelpOf(props.provider, form.environment, wizard.context, tc),
                received: wizard.received ? moneyReceived(wizard.firstEvent, format, tw) : null,
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
                text: { ...moneyWizardText(tw), openProvider: tw("openProvider", { brand: def.brand }) },
            }}
            on={wizard.on}
        />
    )
}

/** Resolves the labels for this form. */
const moneyWizardText = (tw: ReturnType<typeof useTranslations<"connectionWizard">>) => {
    return {
        back: tw("back"),
        next: tw("next"),
        close: tw("close"),
        done: tw("done"),
        skip: tw("skip"),
        earlyAccess: tw("earlyAccess"),
        earlyAccessNote: tw("earlyAccessNote"),
        envHint: tw("envHint"),
        envBadge: tw("envBadgeTest"),
        fieldName: tw("fieldName"),
        fieldNameHint: tw("fieldNameHint"),
        fieldBank: tw("fieldBank"),
        fieldBankPlaceholder: tw("fieldBankPlaceholder"),
        fieldAccount: tw("fieldAccount"),
        fieldHolder: tw("fieldHolder"),
        createdLocked: tw("createdLocked"),
        verifyWaiting: tw("verifyWaiting"),
        verifyError: tw("verifyError"),
    }
}

/** Resolves the provider guide using its saved and drafted values. */
const moneyGuideScreens = (
    provider: MoneyProvider,
    wizard: ReturnType<typeof useMoneyWizard>,
    tc: ReturnType<typeof useTranslations<"connections">>,
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
) => {
    const def = PROVIDERS[provider]
    const { follow } = wizard
    const drafts =
        provider === "sepay"
            ? { webhookName: follow.webhookName, apiKey: follow.apiKey }
            : { webhookName: follow.webhookName }
    return guideScreensOf(
        {
            provider,
            brand: def.brand,
            steps: GUIDES[provider] ?? [],
            ctx: wizard.context,
            values: follow.values,
            drafts,
        },
        tc,
        tw,
    )
}

/** Formats the first bank event using its amount and optional transfer content. */
const moneyReceived = (
    event: FirstEvent | null,
    format: ReturnType<typeof useFormatter>,
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
): string | null => {
    if (event === null) return null
    const amount = format.number(event.amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    return event.content === ""
        ? tw("verifyReceivedNoContent", { amount })
        : tw("verifyReceived", { amount, content: event.content })
}

/** Describes saved or missing keys only for a provider requiring keys. */
const moneyKeysNote = (
    needsKeys: boolean,
    keysSaved: boolean,
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
) => {
    if (!needsKeys) return null
    return tw(keysSaved ? "keysSaved" : "keysHint")
}
