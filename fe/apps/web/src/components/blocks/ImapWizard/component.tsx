import type { useFormatter, useTranslations } from "next-intl"
import type { useImapWizard } from "@/hooks/imap-wizard"
import type { AgentOption, AgentStepView } from "@/modules/types"
import { Alert, Button, CheckboxGroup, RadioGroup, Text } from "@starci/grammar/common"
import { ImapAccountFields, type ImapAccountFieldsProps } from "@/components/composites/ImapAccountFields"

import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import {
    backAction,
    closeAction,
    nextAction,
    WizardFooter,
    type WizardAction,
} from "@/components/composites/WizardFooter"

import { WizardFrame } from "@/components/composites/WizardFrame"

/** One option of a radio or checkbox list. */
interface ImapChoice {
    readonly value: string
    readonly label: string
}

/** The sign-in step: the fields, the provider guide and the connection test. */
interface ImapAccountView {
    readonly fields: ImapAccountFieldsProps
    /** "host:port" of a known provider; null for "other", whose fields show it. */
    readonly server: string | null
    readonly guide: string
    /** The STARTTLS caution; null on TLS. */
    readonly starttls: string | null
    readonly canTest: boolean
    /** The test result once it passed for these settings; null otherwise. */
    readonly tested: string | null
    /** The note that the settings changed since the last test; null otherwise. */
    readonly stale: string | null
}

/** Copy, state and commands of the mailbox (IMAP) wizard. */
export interface ImapWizardBaseProps {
    readonly props: {
        /** The loading sentence while the saved mailbox is read; null once it is. */
        readonly loading: string | null
        /** The back end message when the saved mailbox could not be read; null otherwise. */
        readonly loadError: string | null
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "account" | "folders" | "schedule" | "agent"
        readonly account: ImapAccountView
        readonly folders: {
            readonly options: ReadonlyArray<ImapChoice>
            readonly value: ReadonlyArray<string>
            /** The sentence shown while no folder is picked; null once one is. */
            readonly none: string | null
            readonly since: string
            readonly sinceOptions: ReadonlyArray<ImapChoice>
        }
        readonly schedule: { readonly value: string; readonly options: ReadonlyArray<ImapChoice> }
        readonly agentStep: AgentStepView
        readonly error: string | null
        readonly isPending: boolean
        readonly isTested: boolean
        readonly text: Readonly<
            Record<
                | "back"
                | "next"
                | "close"
                | "done"
                | "save"
                | "test"
                | "intro"
                | "imapOn"
                | "foldersTitle"
                | "foldersHint"
                | "sinceTitle"
                | "sinceHint"
                | "scheduleHint"
                | "scheduleLabel"
                | "saved",
                string
            >
        >
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly test: () => void
        readonly save: () => void
        readonly finish: () => void
        readonly close: () => void
        readonly folders: (paths: ReadonlyArray<string>) => void
        readonly since: (value: string) => void
        readonly schedule: (value: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

const actionsOf = ({ props, on }: ImapWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "account")
        return [
            nextAction(text.next, () => on.go(1), { isDisabled: !props.isTested }),
            closeAction(text.close, on.close),
        ]
    if (props.step === "folders")
        return [nextAction(text.next, () => on.go(2), { isDisabled: props.folders.value.length === 0 }), back]
    if (props.step === "schedule") return [nextAction(text.save, on.save, { isPending: props.isPending }), back]
    return [nextAction(text.done, on.finish, { isPending: props.isPending })]
}

/** What the sign-in step draws and reports. */
interface ImapAccountStepProps {
    readonly view: ImapAccountView
    readonly intro: string
    readonly imapOn: string
    readonly test: string
    readonly isPending: boolean
    readonly onTest: () => void
}

/** The sign-in step: what NIVO reads, the fields, the provider's app-password guide and the test that lists the folders. */
const ImapAccountStep = (props: ImapAccountStepProps) => (
    <>
        <Text size="sm" tone="muted">
            {props.intro}
        </Text>
        <ImapAccountFields {...props.view.fields} />
        {props.view.server === null ? null : (
            <Text size="xs" tone="muted">
                {props.view.server}
            </Text>
        )}
        <Text size="sm" tone="muted">
            {props.view.guide}
        </Text>
        <Text size="xs" tone="muted">
            {props.imapOn}
        </Text>
        {props.view.starttls === null ? null : <Alert tone="cautionary" title={props.view.starttls} />}
        <div>
            <Button
                intent="neutral"
                isPending={props.isPending}
                isDisabled={!props.view.canTest}
                onPress={props.onTest}
            >
                {props.test}
            </Button>
        </div>
        {props.view.tested === null ? null : <Alert tone="affirmative" title={props.view.tested} />}
        {props.view.stale === null ? null : (
            <Text size="xs" tone="muted">
                {props.view.stale}
            </Text>
        )}
    </>
)

/** The mailbox (IMAP, read only) in the shared wizard frame: sign in and test, folders and period, schedule, attach the agents. */
export const ImapWizardBase = (props: ImapWizardBaseProps) => {
    const { props: view, on } = props
    const { text } = view
    if (view.loading !== null) return <Text tone="muted">{view.loading}</Text>
    if (view.loadError !== null) return <Alert tone="negative" title={view.loadError} />
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {view.step === "account" ? (
                <ImapAccountStep
                    view={view.account}
                    intro={text.intro}
                    imapOn={text.imapOn}
                    test={text.test}
                    isPending={view.isPending}
                    onTest={on.test}
                />
            ) : null}
            {view.step === "folders" ? <ImapFoldersStep {...props} /> : null}
            {view.step === "schedule" ? (
                <>
                    <Text size="sm" tone="muted">
                        {text.scheduleHint}
                    </Text>
                    <RadioGroup
                        label={text.scheduleLabel}
                        isLabelHidden
                        value={view.schedule.value}
                        onValueChange={on.schedule}
                        options={view.schedule.options}
                    />
                </>
            ) : null}
            {view.step === "agent" ? (
                <>
                    <Alert tone="affirmative" title={text.saved} />
                    <WizardAgentStep {...view.agentStep} isDisabled={view.isPending} onChange={on.agents} />
                </>
            ) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}

/** Folder selection and the starting point for the first sync. */
const ImapFoldersStep = ({ props: view, on }: ImapWizardBaseProps) => {
    const { text } = view
    return (
        <>
            <Text size="sm" weight="semibold">
                {text.foldersTitle}
            </Text>
            <Text size="sm" tone="muted">
                {text.foldersHint}
            </Text>
            <CheckboxGroup
                label={text.foldersTitle}
                isLabelHidden
                options={view.folders.options}
                value={[...view.folders.value]}
                onValueChange={on.folders}
            />
            {view.folders.none === null ? null : (
                <Text size="xs" tone="muted">
                    {view.folders.none}
                </Text>
            )}
            <Text size="sm" weight="semibold">
                {text.sinceTitle}
            </Text>
            <Text size="sm" tone="muted">
                {text.sinceHint}
            </Text>
            <RadioGroup
                label={text.sinceTitle}
                isLabelHidden
                value={view.folders.since}
                onValueChange={on.since}
                options={view.folders.sinceOptions}
            />
        </>
    )
}

/** What the board hands the mailbox wizard. */
export interface ImapWizardProps {
    /** Workspace agents (any module): every agent may be given read access to the mailbox. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Continue or edit this existing mailbox instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Inputs needed to build the ImapWizardContent section. */
export interface BuildMailboxAccountViewContext {
    readonly values: ReturnType<typeof useImapWizard>["values"]
    readonly savedId: ReturnType<typeof useImapWizard>["savedId"]
    readonly preset: ReturnType<typeof useImapWizard>["preset"]
    readonly t: ReturnType<typeof useTranslations<"connectorImap">>
    readonly isCustom: boolean
    readonly isPending: ReturnType<typeof useImapWizard>["isPending"]
    readonly wizard: ReturnType<typeof useImapWizard>
    readonly format: ReturnType<typeof useFormatter>
}

/** Inputs needed to build the ImapWizardContent section. */
export interface BuildImapWizardViewContext {
    readonly wizard: ReturnType<typeof useImapWizard>
    readonly t: ReturnType<typeof useTranslations<"connectorImap">>
    readonly tc: ReturnType<typeof useTranslations<"connections">>
    readonly tw: ReturnType<typeof useTranslations<"connectionWizard">>
    readonly values: ReturnType<typeof useImapWizard>["values"]
    readonly savedId: ReturnType<typeof useImapWizard>["savedId"]
    readonly preset: ReturnType<typeof useImapWizard>["preset"]
    readonly isCustom: boolean
    readonly isPending: ReturnType<typeof useImapWizard>["isPending"]
    readonly format: ReturnType<typeof useFormatter>
    readonly props: ImapWizardProps
}
