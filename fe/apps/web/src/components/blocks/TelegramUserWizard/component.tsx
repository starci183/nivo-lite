import type { AgentStepView, DataSlot, SlotLabels } from "@/modules/types"
import { Alert, CheckboxGroup, Grid, Input, SegmentedControl, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { TelegramUserChats } from "@/components/composites/TelegramUserChats"
import { TelegramUserLogin } from "@/components/composites/TelegramUserLogin"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { frameOf, WizardFrame } from "@/components/composites/WizardFrame"

/** A field of the personal Telegram login, also its stage. */
type LoginField = "phone" | "code" | "password"
/** One chat of the picker: its kind (and unread count) as description, disabled when the picker is full. */
type ChatOption = {
    readonly value: string
    readonly label: string
    readonly description: string
    readonly isDisabled: boolean
}
/** What the wizard knows once the server answered: whether personal Telegram is set up on it. */
type TelegramReady = { readonly isConfigured: boolean }
/** The chat picker as the step draws it. */
type ChatsView = {
    readonly options: ReadonlyArray<ChatOption>
    readonly value: ReadonlyArray<string>
    readonly query: string
    readonly sinceDays: string
    readonly text: Readonly<
        Record<"hint" | "search" | "placeholder" | "count" | "empty" | "label" | "since" | "since7" | "since30", string>
    >
}
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
        readonly index: number
        /** The first reads: the server and the saved state. Not configured means no Telegram app credentials. */
        readonly boot: DataSlot<TelegramReady>
        readonly bootLabels: SlotLabels
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
        /** The dialogs of the account, read once the owner is signed in. */
        readonly chats: DataSlot<ChatsView>
        readonly chatsLabels: SlotLabels
        /** The owner can go on from the chat step: something is picked and the list is in. */
        readonly canGoOn: boolean
        /** The chat list failed, so the footer offers to read it again. */
        readonly canRetryChats: boolean
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

const loginActionsOf = ({ props, on }: TelegramUserWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text, isPending, valid } = props
    const cancel: WizardAction = {
        id: "cancel",
        label: text.cancelLogin,
        intent: "dismiss",
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
            intent: "alternative",
            isDisabled: isPending,
            onPress: on.resend,
        }
        return [nextAction(text.confirmCode, on.confirmCode, { isPending, isDisabled: !valid.code }), resend, cancel]
    }
    return [nextAction(text.signIn, on.confirmPassword, { isPending, isDisabled: !valid.password }), cancel]
}

const actionsOf = (view: TelegramUserWizardBaseProps, ready: TelegramReady): ReadonlyArray<WizardAction> => {
    const { props, on } = view
    const { text, isPending } = props
    const close = closeAction(text.close, on.close)
    if (!ready.isConfigured) return [nextAction(text.close, on.close)]
    if (props.index === 0) return [nextAction(text.next, () => on.go(1), { isDisabled: !props.valid.consent }), close]
    if (props.index === 1) return loginActionsOf(view)
    if (props.index === 2) {
        const goOn = nextAction(text.next, () => on.go(3), { isDisabled: !props.canGoOn })
        const retry: WizardAction = {
            id: "retry",
            label: text.chatsRetry,
            intent: "alternative",
            onPress: on.reloadChats,
        }
        return props.canRetryChats ? [goOn, retry, close] : [goOn, close]
    }
    if (props.index === 3)
        return [nextAction(text.save, on.save, { isPending }), backAction(text.back, isPending, () => on.go(2))]
    return [nextAction(text.done, on.finish, { isPending })]
}

/** Step "consent": the connection name and the commitment the owner agrees to before logging in. */
const ConsentStep = ({ props, on }: TelegramUserWizardBaseProps) => (
    <>
        <Grid kind="form">
            <Input
                id="tgu-name"
                name="name"
                label={props.text.nameLabel}
                description={props.text.nameHint}
                isDisabled={props.isPending}
                value={props.consent.name}
                onValueChange={(value) => on.field("name", value)}
            />
        </Grid>
        <Text size="sm" weight="semibold">
            {props.text.consentTitle}
        </Text>
        <Text size="sm">{props.text.consent1}</Text>
        <Text size="sm">{props.text.consent2}</Text>
        <Text size="sm">{props.text.consent3}</Text>
        <CheckboxGroup
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

/** The chat step: the picker over the account's dialogs, read through its own slot. */
const ChatsStep = ({ props, on }: TelegramUserWizardBaseProps) => (
    <SlotView slot={props.chats} placeholder={CHATS_PLACEHOLDER} labels={props.chatsLabels} onRetry={on.reloadChats}>
        {(chats, isSkeleton) => (
            <TelegramUserChats
                {...chats}
                isDisabled={props.isPending || isSkeleton}
                onQuery={on.chatQuery}
                onChange={on.chats}
                onSince={on.since}
            />
        )}
    </SlotView>
)

/** The steps once the server state is known: consent, phone login, chat picks, schedule, agents. */
const StepBody = (view: TelegramUserWizardBaseProps) => {
    const { props, on } = view
    if (props.index === 0) return <ConsentStep {...view} />
    if (props.index === 1) return <TelegramUserLogin {...props.login} isDisabled={props.isPending} onField={on.field} />
    if (props.index === 2) return <ChatsStep {...view} />
    if (props.index === 3) return <ScheduleStep {...view} />
    return <WizardAgentStep {...props.agentStep} isDisabled={props.isPending} onChange={on.agents} />
}

/** The footer of a step: no button while the first reads are on their way. */
const footerOf = (props: TelegramUserWizardBaseProps, ready: TelegramReady, isSkeleton: boolean) => (
    <WizardFooter actions={isSkeleton ? [] : actionsOf(props, ready)} isSkeleton={isSkeleton} />
)

/** Setup of a personal Telegram connection (owner only) in the shared wizard frame: consent, phone login, chat picks, schedule, agents. */
export const TelegramUserWizardBase = (props: TelegramUserWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <SlotView slot={view.boot} placeholder={READY_PLACEHOLDER} labels={view.bootLabels} onRetry={on.retry}>
            {(ready, isSkeleton) => (
                <WizardFrame {...frameOf(view)} isSkeleton={isSkeleton} footer={footerOf(props, ready, isSkeleton)}>
                    {ready.isConfigured ? (
                        <StepBody {...props} />
                    ) : (
                        <Alert
                            tone="negative"
                            title={view.text.notConfiguredTitle}
                            description={view.text.notConfiguredBody}
                        />
                    )}
                    {ready.isConfigured && view.error !== null ? <Alert tone="negative" title={view.error} /> : null}
                </WizardFrame>
            )}
        </SlotView>
    )
}
