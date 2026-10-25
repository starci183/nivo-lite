import { Alert, CheckboxGroup, Input, LeadingNumber, List, ListItem, Text } from "@starci/grammar/common"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { WizardCodeBlock } from "@/components/composites/WizardCodeBlock"
import { backAction, closeAction, nextAction, WizardFooter } from "@/components/composites/WizardFooter"
import type { WizardAction } from "@/components/composites/WizardFooter"
import { WizardFrame } from "@/components/composites/WizardFrame"
import { WizardTestAlert } from "@/components/composites/WizardTestAlert"
import type { CopyLabels } from "@/modules/types"
import { webhookWizardClassNames as classNames } from "./classNames"

/** Copy, state and commands of the webhook wizard. */
export interface WebhookWizardBaseProps {
    readonly props: {
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
                | "n8nTitle"
                | "n8nNote"
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

const addressOf = (props: WebhookWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <>
            {view.step === "address" ? (
                <>
                    <div className={classNames.fields}>
                        <Input
                            id="webhook-name"
                            name="name"
                            label={view.text.fieldName}
                            isDisabled={view.isPending}
                            value={view.form.name}
                            onValueChange={on.name}
                        />
                        <Input
                            id="webhook-url"
                            name="url"
                            label={view.text.fieldUrl}
                            placeholder={view.text.urlPlaceholder}
                            hint={view.text.urlHint}
                            isDisabled={view.isPending}
                            value={view.form.url}
                            onValueChange={on.url}
                        />
                    </div>
                    <CheckboxGroup
                        label={view.text.eventsLabel}
                        isDisabled={view.isPending}
                        options={[...view.eventOptions]}
                        value={[...view.events]}
                        onValueChange={(events) => on.events(events)}
                    />
                </>
            ) : null}
        </>
    )
}

/** n8n / Make / Zapier webhook in the shared wizard frame: address and events, signing key, a test send, done. */
export const WebhookWizardBase = (props: WebhookWizardBaseProps) => {
    const { props: view } = props
    return (
        <WizardFrame
            title={view.title}
            stepLabel={view.stepLabel}
            steps={view.steps}
            index={view.index}
            footer={<WizardFooter actions={actionsOf(props)} />}
        >
            {addressOf(props)}
            {view.step === "secret" ? (
                <>
                    <Text size="sm" tone="muted">
                        {view.text.secretIntro}
                    </Text>
                    <ConnectionCopyInput
                        id="webhook-signing-secret"
                        name="signingSecret"
                        label={view.text.secretLabel}
                        value={view.signingSecret}
                        isSecret
                        labels={view.copy}
                    />
                    <Text weight="semibold">{view.text.n8nTitle}</Text>
                    <List as="ol" className={classNames.numbered}>
                        {view.n8nSteps.map((step, position) => (
                            <ListItem key={step}>
                                <Text size="sm" startContent={<LeadingNumber position={position + 1} />}>
                                    {step}
                                </Text>
                            </ListItem>
                        ))}
                    </List>
                    <WizardCodeBlock
                        code={view.snippet}
                        label={view.text.codeLabel}
                        copyLabel={view.copy.copy}
                        copiedLabel={view.copy.copied}
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
            {view.error === null ? null : <Alert tone="negative" title={view.error} />}
        </WizardFrame>
    )
}
