import type { AgentOption } from "@/modules/types"
import type { useTranslations } from "next-intl"
import type { useTelegramUserWizard } from "@/hooks/telegram-user-wizard"
import { Alert, CheckboxGroup, Input, SegmentedControl, Text } from "@starci/grammar/common"
import { TelegramUserChats } from "@/components/composites/TelegramUserChats"
import { TelegramUserLogin } from "@/components/composites/TelegramUserLogin"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import type { AgentStepView } from "@/modules/types"
import { telegramUserWizardClassNames as classNames } from "./classNames"

/** A field of the personal Telegram login, also its stage. */
type LoginField = "phone" | "code" | "password"
/** One chat of the picker: its kind (and unread count) as description, disabled when the picker is full. */
type ChatOption = {
    readonly value: string
    readonly label: string
    readonly description: string
    readonly isDisabled: boolean
}
/** What the frame reads before the steps can start. */
type BootBodyProps = Pick<TelegramUserWizardBaseProps, "props">

/** Copy, state and commands of the personal Telegram wizard. */
export interface TelegramUserWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        /** Reading the server first; unconfigured: no Telegram app credentials; failed: the saved state could not be read. */
        readonly status: "loading" | "unconfigured" | "failed" | "ready"
        readonly bootError: string | null
        readonly isPending: boolean
        readonly error: string | null
        readonly consent: { readonly name: string; readonly isChecked: boolean }
        readonly valid: Readonly<Record<"consent" | "phone" | "code" | "password", boolean>>
        readonly login: {
            readonly stage: LoginField
            readonly sentLine: string | null
            readonly values: Readonly<Record<LoginField, string>>
            readonly text: Readonly<
                Record<
                    "phone" | "phoneHint" | "code" | "codeHint" | "passwordTitle" | "password" | "passwordHint",
                    string
                >
            >
        }
        readonly chats: {
            readonly options: ReadonlyArray<ChatOption>
            readonly value: ReadonlyArray<string>
            readonly query: string
            readonly sinceDays: string
            readonly text: Readonly<
                Record<
                    "hint" | "search" | "placeholder" | "count" | "empty" | "label" | "since" | "since7" | "since30",
                    string
                >
            >
        }
        readonly chatsLoading: boolean
        readonly chatsFailed: boolean
        readonly hasPicks: boolean
        readonly every: string
        readonly agentStep: AgentStepView
        readonly text: Readonly<
            Record<
                | "close"
                | "back"
                | "next"
                | "done"
                | "save"
                | "sendCode"
                | "confirmCode"
                | "resend"
                | "cancelLogin"
                | "signIn"
                | "chatsRetry"
                | "chatsLoading"
                | "loading"
                | "notConfiguredTitle"
                | "notConfiguredBody"
                | "nameLabel"
                | "nameHint"
                | "consentTitle"
                | "consent1"
                | "consent2"
                | "consent3"
                | "consentLabel"
                | "scheduleLabel"
                | "scheduleManual"
                | "schedule15"
                | "schedule60"
                | "scheduleHint",
                string
            >
        >
    }
    readonly on: {
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

const loginActionsOf = ({ props, on }: TelegramUserWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text, isPending, valid } = props
    const cancel: WizardAction = {
        id: "cancel",
        label: text.cancelLogin,
        variant: "ghost",
        isDisabled: isPending,
        onPress: on.cancelLogin,
    }
    if (props.login.stage === "phone") {
        return [
            nextAction(text.sendCode, on.sendCode, { isPending, isDisabled: !valid.phone }),
            backAction(text.back, isPending, () => on.go(0)),
        ]
    }
    if (props.login.stage === "code") {
        const resend: WizardAction = {
            id: "resend",
            label: text.resend,
            variant: "outline",
            isDisabled: isPending,
            onPress: on.resend,
        }
        return [nextAction(text.confirmCode, on.confirmCode, { isPending, isDisabled: !valid.code }), resend, cancel]
    }
    return [nextAction(text.signIn, on.confirmPassword, { isPending, isDisabled: !valid.password }), cancel]
}

const actionsOf = (view: TelegramUserWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { props, on } = view
    const { text, isPending } = props
    const close = closeAction(text.close, on.close)
    if (props.status === "loading") return []
    if (props.status !== "ready") return [nextAction(text.close, on.close)]
    if (props.index === 0) return [nextAction(text.next, () => on.go(1), { isDisabled: !props.valid.consent }), close]
    if (props.index === 1) return loginActionsOf(view)
    if (props.index === 2) {
        const goOn = nextAction(text.next, () => on.go(3), { isDisabled: !props.hasPicks || props.chatsLoading })
        const retry: WizardAction = { id: "retry", label: text.chatsRetry, variant: "outline", onPress: on.reloadChats }
        return props.chatsFailed ? [goOn, retry, close] : [goOn, close]
    }
    if (props.index === 3)
        return [nextAction(text.save, on.save, { isPending }), backAction(text.back, isPending, () => on.go(2))]
    return [nextAction(text.done, on.finish, { isPending })]
}

/** Step "consent": the connection name and the commitment the owner agrees to before logging in. */
const ConsentStep = ({ props, on }: TelegramUserWizardBaseProps) => (
    <>
        <div className={classNames.fields}>
            <Input
                id="tgu-name"
                name="name"
                label={props.text.nameLabel}
                variant="secondary"
                hint={props.text.nameHint}
                isDisabled={props.isPending}
                value={props.consent.name}
                onValueChange={(value) => on.field("name", value)}
            />
        </div>
        <Text size="sm" weight="semibold">
            {props.text.consentTitle}
        </Text>
        <Text size="sm">{props.text.consent1}</Text>
        <Text size="sm">{props.text.consent2}</Text>
        <Text size="sm">{props.text.consent3}</Text>
        <CheckboxGroup
            variant="secondary"
            label={props.text.consentTitle}
            isLabelHidden
            options={[{ value: "yes", label: props.text.consentLabel }]}
            value={props.consent.isChecked ? ["yes"] : []}
            onValueChange={(value) => on.consent(value.includes("yes"))}
        />
    </>
)

/** Step "schedule": how often new messages are read. */
const ScheduleStep = ({ props, on }: TelegramUserWizardBaseProps) => (
    <>
        <SegmentedControl
            label={props.text.scheduleLabel}
            value={props.every}
            width="fill"
            options={[
                { value: "0", label: props.text.scheduleManual },
                { value: "15", label: props.text.schedule15 },
                { value: "60", label: props.text.schedule60 },
            ]}
            onValueChange={on.every}
        />
        <Text size="sm" tone="muted">
            {props.text.scheduleHint}
        </Text>
    </>
)

/** What the frame shows before the steps can start: the server is being read, is not set up, or the saved state failed. */
const BootBody = ({ props }: BootBodyProps) => {
    if (props.status === "loading") {
        return (
            <Text size="sm" live="polite">
                {props.text.loading}
            </Text>
        )
    }
    if (props.status === "unconfigured") {
        return (
            <Alert tone="negative" title={props.text.notConfiguredTitle} description={props.text.notConfiguredBody} />
        )
    }
    return props.bootError === null ? null : <Alert tone="negative" title={props.bootError} />
}

/** The steps once the server state is known: consent, phone login, chat picks, schedule, agents. */
const StepBody = (view: TelegramUserWizardBaseProps) => {
    const { props, on } = view
    if (props.index === 0) return <ConsentStep {...view} />
    if (props.index === 1) return <TelegramUserLogin {...props.login} isDisabled={props.isPending} onField={on.field} />
    if (props.index === 2 && props.chatsLoading) {
        return (
            <Text size="sm" live="polite">
                {props.text.chatsLoading}
            </Text>
        )
    }
    if (props.index === 2) {
        return (
            <TelegramUserChats
                {...props.chats}
                isDisabled={props.isPending}
                onQuery={on.chatQuery}
                onChange={on.chats}
                onSince={on.since}
            />
        )
    }
    if (props.index === 3) return <ScheduleStep {...view} />
    return <WizardAgentStep {...props.agentStep} isDisabled={props.isPending} onChange={on.agents} />
}

/** Setup of a personal Telegram connection (owner only) in the shared wizard frame: consent, phone login, chat picks, schedule, agents. */
export const TelegramUserWizardBase = (props: TelegramUserWizardBaseProps) => {
    const { props: view } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.status === "ready" ? <StepBody {...props} /> : <BootBody props={view} />}
            {view.status === "ready" && view.error !== null ? <Alert tone="negative" title={view.error} /> : null}
        </WizardFrame>
    )
}

/** State values and commands consumed by the connected surface. */
export interface TelegramUserWizardProps {
    /** Workspace agents (any module): every agent may be given read access to a data source. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Continue or edit this existing connection instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list refreshes. */
    readonly onClose: (changed: boolean) => void
}

/** State values and commands consumed by the connected surface. */
export type TelegramUserWizardControllerInput = {
    readonly props: TelegramUserWizardProps
    readonly t: ReturnType<typeof useTranslations<"connectorTelegramUser">>
    readonly tw: ReturnType<typeof useTranslations<"connectionWizard">>
    readonly tc: ReturnType<typeof useTranslations<"connections">>
    readonly wizard: ReturnType<typeof useTelegramUserWizard>
}
