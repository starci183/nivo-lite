import type { DataSlot, SlotLabels, CopyLabels } from "@/modules/types"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Alert, CheckboxGroup, EmptyNotice, Input, Section, Stack, Text } from "@starci/grammar/common"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { WizardCodeBlock } from "@/components/composites/WizardCodeBlock"
import {
    backAction,
    closeAction,
    nextAction,
    WizardFooter,
    type WizardAction,
} from "@/components/branches/WizardFooter"
import { WizardFrame } from "@/components/frames/WizardFrame"
import { WizardTestAlert } from "@/components/composites/WizardTestAlert"

/** The ready drawing with its canonical first-read loading atom. */
type WebhookWizardDrawLoadingProps = WebhookWizardBaseProps & { readonly isLoading: boolean }

/** Copy, state and commands of the webhook wizard. */
export interface WebhookWizardBaseProps {
    readonly props: {
        readonly boot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly index: number
        readonly step: "address" | "secret" | "test" | "done"
        readonly form: { readonly name: string; readonly url: string }
        readonly events: ReadonlyArray<string>
        readonly eventOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly signingSecret: string
        readonly copy: CopyLabels
        readonly n8nSteps: ReadonlyArray<string>
        /** The n8n Code node that checks a delivery's signature. */
        readonly snippet: string
        readonly test: { readonly isOk: boolean; readonly title: string; readonly description: string } | null
        readonly error: string | null
        readonly isPending: boolean
        readonly text: Readonly<
            Record<
                | "saveAndNext"
                | "next"
                | "back"
                | "close"
                | "finish"
                | "sendTest"
                | "sendAgain"
                | "fieldName"
                | "fieldUrl"
                | "urlHint"
                | "urlPlaceholder"
                | "eventsLabel"
                | "secretIntro"
                | "secretLabel"
                | "secretOnce"
                | "n8nTitle"
                | "n8nNote"
                | "n8nEmpty"
                | "codeLabel"
                | "testIntro"
                | "testWarn"
                | "doneIntro",
                string
            >
        >
    }
    readonly on: {
        readonly go: (to: number) => void
        readonly save: () => void
        readonly sendTest: () => void
        readonly finish: () => void
        readonly close: () => void
        readonly name: (value: string) => void
        readonly url: (value: string) => void
        readonly events: (events: ReadonlyArray<string>) => void
    }
}

const actionsOf = ({ props, on }: WebhookWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    if (props.step === "address") {
        const missing = props.form.name.trim() === "" || props.form.url.trim() === "" || props.events.length === 0
        return [
            nextAction(text.saveAndNext, on.save, { isPending: props.isPending, isDisabled: missing }),
            closeAction(text.close, on.close, props.isPending),
        ]
    }
    if (props.step === "secret") return [nextAction(text.next, () => on.go(2))]
    if (props.step === "test") {
        const sent = props.test !== null
        const test: WizardAction = {
            id: "test",
            label: sent ? text.sendAgain : text.sendTest,
            intent: "alternative",
            isPending: props.isPending,
            onPress: on.sendTest,
        }
        return [nextAction(text.next, () => on.go(3), { isDisabled: !sent }), test]
    }
    return [
        nextAction(text.finish, on.finish, { isPending: props.isPending }),
        backAction(text.back, props.isPending, () => on.go(2)),
    ]
}

const addressOf = (props: WebhookWizardDrawLoadingProps) => {
    const { props: view, on } = props
    return view.step === "address" ? (
        <>
            <Stack gap="row">
                <Input
                    id="webhook-name"
                    name="name"
                    label={view.text.fieldName}
                    isDisabled={view.isPending}
                    value={view.form.name}
                    onValueChange={on.name}
                    isLoading={props.isLoading}
                />
                <Input
                    id="webhook-url"
                    name="url"
                    label={view.text.fieldUrl}
                    placeholder={view.text.urlPlaceholder}
                    description={view.text.urlHint}
                    isDisabled={view.isPending}
                    value={view.form.url}
                    onValueChange={on.url}
                    isLoading={props.isLoading}
                />
            </Stack>
            <CheckboxGroup
                label={view.text.eventsLabel}
                isDisabled={view.isPending}
                options={[...view.eventOptions]}
                value={[...view.events]}
                onValueChange={(events) => on.events(events)}
                isLoading={props.isLoading}
            />
        </>
    ) : null
}

/** n8n / Make / Zapier webhook in the shared wizard frame: address and events, signing key, a test send, done. */
const renderWebhookWizard = (props: WebhookWizardBaseProps, isLoading: boolean) => {
    const { props: view } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} isLoading={isLoading} />}
        >
            {addressOf({ ...props, isLoading: isLoading })}
            {view.step === "secret" ? (
                <>
                    <Text size="sm" tone="muted">
                        {view.text.secretIntro}
                    </Text>
                    <Alert tone="cautionary" title={view.text.secretOnce} isLoading={isLoading} />
                    <ConnectionCopyInput
                        id="webhook-signing-secret"
                        name="signingSecret"
                        label={view.text.secretLabel}
                        value={view.signingSecret}
                        isSecret
                        labels={view.copy}
                        isLoading={isLoading}
                    />
                    <Section
                        kind="list"
                        title={view.text.n8nTitle}
                        headingLevel={3}
                        items={view.n8nSteps.map((step, position) => ({
                            id: String(position + 1),
                            title: step,
                            leading: { position: position + 1 },
                        }))}
                        empty={<EmptyNotice message={view.text.n8nEmpty} />}
                        isLoading={isLoading}
                    />
                    <WizardCodeBlock
                        code={view.snippet}
                        label={view.text.codeLabel}
                        copyLabel={view.copy.copy}
                        copiedLabel={view.copy.copied}
                        isLoading={isLoading}
                    />
                    <Text size="xs" tone="muted">
                        {view.text.n8nNote}
                    </Text>
                </>
            ) : null}
            {view.step === "test" ? (
                <>
                    <Text size="sm" tone="muted">
                        {view.text.testIntro}
                    </Text>
                    {view.test === null ? null : (
                        <WizardTestAlert
                            isOk={view.test.isOk}
                            title={view.test.title}
                            description={view.test.description}
                            isLoading={isLoading}
                        />
                    )}
                    {view.test !== null && !view.test.isOk ? (
                        <Text size="sm" tone="muted">
                            {view.text.testWarn}
                        </Text>
                    ) : null}
                </>
            ) : null}
            {view.step === "done" ? (
                <Text size="sm" tone="muted">
                    {view.text.doneIntro}
                </Text>
            ) : null}
            {view.error === null ? null : <Alert tone="negative" title={view.error} isLoading={isLoading} />}
        </WizardFrame>
    )
}

/** Draws the selected wizard's existing ready tree from its actual dependency reads. */
export const WebhookWizardBase = (props: WebhookWizardBaseProps) => (
    <SlotView
        slot={props.props.boot}
        placeholder={true}
        labels={props.props.slotLabels}
        render={(_ready, isLoading) => renderWebhookWizard(props, isLoading)}
    />
)
