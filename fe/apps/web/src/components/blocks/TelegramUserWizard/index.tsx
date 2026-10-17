"use client"

import type { TelegramUserWizardProps, TelegramUserWizardControllerInput } from "./component"
import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf } from "@/hooks/connection-wizard"
import { MAX_CHATS, useTelegramUserWizard } from "@/hooks/telegram-user-wizard"
import { TelegramUserWizardBase } from "./component"
import type { TelegramUserWizardBaseProps } from "./component"

/** What the board hands the personal Telegram wizard. */

/** Setup of a personal Telegram connection (owner only): consent, phone login, chat picks, schedule, agents. */
const createTelegramUserWizardController = (input: TelegramUserWizardControllerInput) => {
    const { t, wizard } = input

    const { login, picks, on } = wizard
    const steps = [t("stepConsent"), t("stepLogin"), t("stepChats"), t("stepSchedule"), t("stepAgent")]
    const kindName = { user: t("kindUser"), group: t("kindGroup"), channel: t("kindChannel") } as const
    const sentLine = { app: t("codeSentApp"), sms: t("codeSentSms"), resent: t("resent") } as const
    return { ...input, login, picks, on, steps, kindName, sentLine }
}

/** Connects the workspace state and commands to the visual surface. */
export const TelegramUserWizard = (props: TelegramUserWizardProps) => {
    const t = useTranslations("connectorTelegramUser")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const wizard = useTelegramUserWizard({ resumeId: props.resumeId, onClose: props.onClose })
    const context = createTelegramUserWizardController({ props, t, tw, tc, wizard })

    return <TelegramUserWizardBase {...createTelegramUserWizardView(context)} />
}

const createTelegramChats = ({
    t,
    picks,
    kindName,
}: ReturnType<typeof createTelegramUserWizardController>): TelegramUserWizardBaseProps["props"]["chats"] => ({
    options: picks.visible.map((chat) => ({
        value: chat.id,
        label: chat.title,
        description:
            chat.unread > 0 ? `${kindName[chat.kind]} · ${t("unread", { n: chat.unread })}` : kindName[chat.kind],
        isDisabled: picks.full && !picks.pickedIds.has(chat.id),
    })),
    value: picks.visible.filter((chat) => picks.pickedIds.has(chat.id)).map((chat) => chat.id),
    query: picks.query,
    sinceDays: String(picks.sinceDays),
    text: {
        hint: t("chatsHint", { max: MAX_CHATS }),
        search: t("searchLabel"),
        placeholder: t("searchPlaceholder"),
        count: t("pickedCount", { n: picks.picked.length, max: MAX_CHATS }),
        empty: t("chatsEmpty"),
        label: t("stepChats"),
        since: t("sinceLabel"),
        since7: t("since7"),
        since30: t("since30"),
    },
})

const createTelegramText = ({
    t,
}: ReturnType<typeof createTelegramUserWizardController>): TelegramUserWizardBaseProps["props"]["text"] => ({
    close: t("close"),
    back: t("back"),
    next: t("next"),
    done: t("done"),
    save: t("save"),
    sendCode: t("sendCode"),
    confirmCode: t("confirmCode"),
    resend: t("resend"),
    cancelLogin: t("cancelLogin"),
    signIn: t("signIn"),
    chatsRetry: t("chatsRetry"),
    chatsLoading: t("chatsLoading"),
    loading: t("loading"),
    notConfiguredTitle: t("notConfiguredTitle"),
    notConfiguredBody: t("notConfiguredBody"),
    nameLabel: t("nameLabel"),
    nameHint: t("nameHint"),
    consentTitle: t("consentTitle"),
    consent1: t("consent1"),
    consent2: t("consent2"),
    consent3: t("consent3"),
    consentLabel: t("consentLabel"),
    scheduleLabel: t("scheduleLabel"),
    scheduleManual: t("scheduleManual"),
    schedule15: t("schedule15"),
    schedule60: t("schedule60"),
    scheduleHint: t("scheduleHint"),
})

const createTelegramUserWizardView = (
    context: ReturnType<typeof createTelegramUserWizardController>,
): React.ComponentProps<typeof TelegramUserWizardBase> => {
    const { props } = context

    const { t, tw, tc, wizard, login, picks, on, steps, sentLine } = context
    return {
        props: {
            title: tw("title", { provider: tc(providerKey("telegram_user", "title")) }),
            stepLabel: tw("stepOf", { n: wizard.index + 1, total: steps.length }),
            steps,
            index: wizard.index,
            status: wizard.status,
            bootError: wizard.bootError,
            isPending: wizard.isPending,
            error: wizard.error,
            consent: { name: wizard.values.name, isChecked: wizard.values.consent },
            valid: wizard.valid,
            login: {
                stage: login.stage,
                sentLine: login.sentVia === null ? null : sentLine[login.sentVia],
                values: { phone: wizard.values.phone, code: wizard.values.code, password: wizard.values.password },
                text: {
                    phone: t("phoneLabel"),
                    phoneHint: t("phoneHint"),
                    code: t("codeLabel"),
                    codeHint: t("codeHint"),
                    passwordTitle: t("passwordTitle"),
                    password: t("passwordLabel"),
                    passwordHint: t("passwordHint"),
                },
            },
            chats: createTelegramChats(context),
            chatsLoading: picks.loading,
            chatsFailed: picks.failed,
            hasPicks: picks.picked.length > 0,
            every: picks.every,
            agentStep: {
                title: t("agentTitle"),
                notice: null,
                agents: agentChoicesOf(props.agents, "telegram_user", tw),
                value: wizard.agentIds,
                hint: tw("agentHint"),
                none: tw("agentNone"),
            },
            text: createTelegramText(context),
        },
        on: {
            go: on.go,
            close: on.close,
            field: on.field,
            consent: on.consent,
            sendCode: login.sendCode,
            confirmCode: login.confirmCode,
            confirmPassword: login.confirmPassword,
            resend: login.resend,
            cancelLogin: login.cancel,
            reloadChats: on.reloadChats,
            chatQuery: picks.setQuery,
            chats: picks.change,
            since: (value) => picks.setSinceDays(value === "30" ? 30 : 7),
            every: picks.setEvery,
            save: on.save,
            finish: on.finish,
            agents: on.setAgentIds,
        },
    }
}
