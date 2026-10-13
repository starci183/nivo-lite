"use client"

import { useTranslations } from "next-intl"
import { Alert, SegmentedControl, Text } from "@starci/grammar/common"
import { useTelegramUserWizard } from "@/hooks/telegram-user-wizard"
import type { TelegramInitial } from "@/hooks/telegram-user-wizard"
import { AgentStep } from "../../AgentStep"
import type { AgentOption } from "../../AgentStep"
import { WizardFrame } from "../../WizardFrame"
import { ChatPicker } from "./ChatPicker"
import { ConsentStep } from "./ConsentStep"
import { LoginStep } from "./LoginStep"
import { TelegramFooter } from "./TelegramFooter"

/** Props for {@link TelegramUserBody}. */
export type TelegramUserBodyProps = {
    readonly title: string
    readonly agents: ReadonlyArray<AgentOption>
    readonly resumeId: string | undefined
    readonly initial: TelegramInitial
    readonly onClose: (changed: boolean) => void
}

/** The steps of the personal Telegram wizard once the server state is known. */
export const TelegramUserBody = ({ title, agents, resumeId, initial, onClose }: TelegramUserBodyProps) => {
    const t = useTranslations("connectorTelegramUser")
    const wizard = useTelegramUserWizard({ resumeId, initial, onClose })
    const { index, picks, on } = wizard
    const names = [t("stepConsent"), t("stepLogin"), t("stepChats"), t("stepSchedule"), t("stepAgent")]
    return (
        <WizardFrame
            title={title}
            steps={names}
            index={index}
            footer={<TelegramFooter wizard={wizard} onClose={onClose} />}
        >
            {index === 0 ? <ConsentStep wizard={wizard} /> : null}
            {index === 1 ? <LoginStep wizard={wizard} /> : null}
            {index === 2 && picks.loading ? (
                <Text size="sm" live="polite">
                    {t("chatsLoading")}
                </Text>
            ) : null}
            {index === 2 && !picks.loading ? (
                <>
                    <ChatPicker
                        chats={picks.chats}
                        picked={picks.picked}
                        onPicked={picks.setPicked}
                        isDisabled={wizard.isPending}
                    />
                    <SegmentedControl
                        label={t("sinceLabel")}
                        value={String(picks.sinceDays)}
                        options={[
                            { value: "7", label: t("since7") },
                            { value: "30", label: t("since30") },
                        ]}
                        onValueChange={(value) => picks.setSinceDays(value === "30" ? 30 : 7)}
                    />
                </>
            ) : null}
            {index === 3 ? (
                <>
                    <SegmentedControl
                        label={t("scheduleLabel")}
                        value={picks.every}
                        width="fill"
                        options={[
                            { value: "0", label: t("scheduleManual") },
                            { value: "15", label: t("schedule15") },
                            { value: "60", label: t("schedule60") },
                        ]}
                        onValueChange={picks.setEvery}
                    />
                    <Text size="sm" tone="muted">
                        {t("scheduleHint")}
                    </Text>
                </>
            ) : null}
            {index === 4 ? (
                <>
                    <Text size="sm" weight="semibold">
                        {t("agentTitle")}
                    </Text>
                    <AgentStep
                        agents={agents}
                        value={wizard.agentIds}
                        onValue={on.setAgentIds}
                        isDisabled={wizard.isPending}
                    />
                </>
            ) : null}
            {wizard.error === null ? null : <Alert tone="negative" title={wizard.error} />}
        </WizardFrame>
    )
}
