"use client"

import { useTranslations } from "next-intl"
import { GUIDES } from "@/hooks/connection-guides"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf, EMPTY_GUIDE_CONTEXT, guideScreensOf, useCopyLabels } from "@/hooks/connection-wizard"
import { TELEGRAM_STEPS, useTelegramWizard } from "@/hooks/telegram-wizard"
import { writeTelegram } from "@/modules/api/channel-connections/write-telegram"
import { writeCheck } from "@/modules/api/connections/write-check"
import { writeConnectionAgents } from "@/modules/api/connections/write-connection-agents"
import type { AgentOption } from "@/modules/types"
import { TelegramWizardBase } from "./component"

/** What the board hands the Telegram wizard. */
interface TelegramWizardProps {
    readonly workspaceId: string
    /** The workspace agents that can work through Telegram. */
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Telegram in the shared wizard frame: BotFather steps, paste the token, check the bot, attach it to the agents. */
export const TelegramWizard = (props: TelegramWizardProps) => {
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const copy = useCopyLabels()
    const { workspaceId } = props
    const wizard = useTelegramWizard({
        agents: props.agents,
        onClose: props.onClose,
        actions: {
            connect: (form) => writeTelegram({ workspaceId, ...form }),
            check: (connectionId) => writeCheck({ workspaceId, connectionId }),
            setAgents: (connectionId, agents) => writeConnectionAgents({ workspaceId, connectionId, agents }),
        },
    })
    const def = PROVIDERS.telegram
    const screens = guideScreensOf(
        {
            provider: "telegram",
            steps: GUIDES.telegram ?? [],
            ctx: EMPTY_GUIDE_CONTEXT,
            brand: def.brand,
            values: {},
            drafts: {},
        },
        tc,
        tw,
    )
    return (
        <TelegramWizardBase
            props={{
                title: tw("title", { provider: tc(providerKey("telegram", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: TELEGRAM_STEPS.length }),
                steps: [tw("stepBot"), tw("stepToken"), tw("stepVerify"), tw("stepAgent")],
                index: wizard.index,
                step: wizard.step,
                providerHref: def.dashboard.live ?? "",
                screens,
                copy,
                form: wizard.form,
                check: wizard.check,
                error: wizard.error,
                isPending: wizard.isPending,
                isChecking: wizard.isChecking,
                agentStep: {
                    title: tw("agentTitleChannel"),
                    notice: null,
                    agents: agentChoicesOf(props.agents, "telegram", tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                text: {
                    back: tw("back"),
                    next: tw("next"),
                    close: tw("close"),
                    done: tw("done"),
                    retry: tw("tgRetry"),
                    openProvider: tw("tgOpenBotFather"),
                    fieldName: tc("fieldName"),
                    fieldNameHint: tc("fieldNameHint"),
                    fieldToken: tc("fieldToken"),
                    tokenHint: tw("tgTokenHint"),
                    checking: tw("tgChecking"),
                },
            }}
            on={wizard.on}
        />
    )
}
