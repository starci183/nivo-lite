import type {
    AgentStepView,
    DataSlot,
    SlotLabels,
    TelegramUserWizardCopy,
    TelegramUserLoginView,
    TelegramUserChatsView as ChatsView,
    WizardPhases,
} from "@/modules/types"
import { Alert } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { TelegramUserChats } from "@/components/composites/TelegramUserChats"
import { TelegramUserLogin } from "@/components/composites/TelegramUserLogin"
import { TelegramUserConsentStep } from "@/components/composites/TelegramUserConsentStep"
import { TelegramUserScheduleStep } from "@/components/composites/TelegramUserScheduleStep"
import { TelegramUserWizardFooter } from "@/components/composites/TelegramUserWizardFooter"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { frameOf, WizardFrame } from "@/components/frames/WizardFrame"

/** The ready drawing with its canonical first-read loading atom. */
type TelegramUserWizardDrawLoadingProps = TelegramUserWizardBaseProps & { readonly isLoading: boolean }
/** What the wizard knows once the server answered: whether personal Telegram is set up on it. */
type TelegramReady = { readonly isConfigured: boolean }
/** The wizard as the first reads leave it before they are known: the placeholder drawn meanwhile. */
const READY_PLACEHOLDER: TelegramReady = { isConfigured: true }
/** The picker drawn while the dialogs are read: no chat yet, the same controls. */
const CHATS_PLACEHOLDER: ChatsView = {
    options: [],
    value: [],
    query: "",
    sinceDays: "7",
    text: {
        hint: "",
        search: "",
        placeholder: "",
        count: "",
        empty: "",
        label: "",
        since: "",
        since7: "",
        since30: "",
    },
}

/** Copy, state and commands of the personal Telegram wizard. */
export interface TelegramUserWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly phases: WizardPhases
        readonly index: number
        /** The first reads: the server and the saved state. Not configured means no Telegram app credentials. */
        readonly boot: DataSlot<TelegramReady>
        readonly bootLabels: SlotLabels
        readonly isPending: boolean
        readonly error: string | null
        readonly consent: { readonly name: string; readonly isChecked: boolean }
        readonly valid: Readonly<Record<"consent" | "phone" | "code" | "password", boolean>>
        readonly login: TelegramUserLoginView
        /** The dialogs of the account, read once the owner is signed in. */
        readonly chats: DataSlot<ChatsView>
        readonly chatsLabels: SlotLabels
        /** The owner can go on from the chat step: something is picked and the list is in. */
        readonly canGoOn: boolean
        /** The chat list failed, so the footer offers to read it again. */
        readonly canRetryChats: boolean
        readonly every: string
        readonly agentStep: AgentStepView
        readonly text: TelegramUserWizardCopy
    }
    readonly on: {
        readonly retry: () => void
        readonly go: (to: number) => void
        readonly close: () => void
        readonly field: (field: "name" | "phone" | "code" | "password", value: string) => void
        readonly consent: (on: boolean) => void
        readonly sendCode: () => void
        readonly confirmCode: () => void
        readonly confirmPassword: () => void
        readonly resend: () => void
        readonly cancelLogin: () => void
        readonly reloadChats: () => void
        readonly chatQuery: (value: string) => void
        readonly chats: (ids: ReadonlyArray<string>) => void
        readonly since: (value: string) => void
        readonly every: (value: string) => void
        readonly save: () => void
        readonly finish: () => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

/** The chat step: the picker over the account's dialogs, read through its own slot. */
const ChatsStep = ({ props, on }: TelegramUserWizardBaseProps) => (
    <SlotView
        slot={props.chats}
        placeholder={CHATS_PLACEHOLDER}
        labels={props.chatsLabels}
        onRetry={on.reloadChats}
        render={(chats, isLoading) => (
            <TelegramUserChats
                {...chats}
                isDisabled={props.isPending}
                isLoading={isLoading}
                onQuery={on.chatQuery}
                onChange={on.chats}
                onSince={on.since}
            />
        )}
    />
)

/** The steps once the server state is known: consent, phone login, chat picks, schedule, agents. */
const StepBody = (view: TelegramUserWizardDrawLoadingProps) => {
    const { props, on } = view
    if (props.index === 0)
        return (
            <TelegramUserConsentStep
                name={props.consent.name}
                isChecked={props.consent.isChecked}
                text={props.text}
                isDisabled={props.isPending}
                isLoading={view.isLoading}
                onName={(value) => on.field("name", value)}
                onConsent={on.consent}
            />
        )
    if (props.index === 1)
        return (
            <TelegramUserLogin
                {...props.login}
                isLoading={view.isLoading}
                isDisabled={props.isPending}
                onField={on.field}
            />
        )
    if (props.index === 2) return <ChatsStep {...view} />
    if (props.index === 3)
        return (
            <TelegramUserScheduleStep
                every={props.every}
                text={props.text}
                isLoading={view.isLoading}
                onChange={on.every}
            />
        )
    return (
        <WizardAgentStep
            {...props.agentStep}
            isLoading={view.isLoading}
            isDisabled={props.isPending}
            onChange={on.agents}
        />
    )
}

/** Setup of a personal Telegram connection (owner only) in the shared wizard frame: consent, phone login, chat picks, schedule, agents. */
export const TelegramUserWizardBase = (props: TelegramUserWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <SlotView
            slot={view.boot}
            placeholder={READY_PLACEHOLDER}
            labels={view.bootLabels}
            onRetry={on.retry}
            render={(ready, isLoading) => (
                <WizardFrame
                    {...frameOf(view)}
                    phases={view.phases}
                    footer={
                        <TelegramUserWizardFooter
                            index={view.index}
                            isConfigured={ready.isConfigured}
                            loginStage={view.login.stage}
                            valid={view.valid}
                            isPending={view.isPending}
                            canGoOn={view.canGoOn}
                            canRetryChats={view.canRetryChats}
                            text={view.text}
                            isLoading={isLoading}
                            onGo={on.go}
                            onClose={on.close}
                            onSendCode={on.sendCode}
                            onConfirmCode={on.confirmCode}
                            onConfirmPassword={on.confirmPassword}
                            onResend={on.resend}
                            onCancelLogin={on.cancelLogin}
                            onReloadChats={on.reloadChats}
                            onSave={on.save}
                            onFinish={on.finish}
                        />
                    }
                >
                    {ready.isConfigured ? (
                        <StepBody {...props} isLoading={isLoading} />
                    ) : (
                        <Alert
                            tone="negative"
                            title={view.text.notConfiguredTitle}
                            description={view.text.notConfiguredBody}
                            isLoading={isLoading}
                        />
                    )}
                    {ready.isConfigured && view.error !== null ? (
                        <Alert tone="negative" title={view.error} isLoading={isLoading} />
                    ) : null}
                </WizardFrame>
            )}
        />
    )
}
