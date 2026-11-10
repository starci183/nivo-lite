import { Alert, Button, Cluster, Grid, Input, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { WizardAgentStep } from "@/components/composites/WizardAgentStep"
import { WizardFooter, backAction, closeAction, forwardAction, nextAction } from "@/components/branches/WizardFooter"
import type { WizardAction } from "@/components/branches/WizardFooter"
import { frameOf, WizardFrame } from "@/components/frames/WizardFrame"
import { WizardGuideView } from "@/components/composites/WizardGuideView"
import { WizardVerifyStep } from "@/components/composites/WizardVerifyStep"
import type {
    AgentStepView,
    CopyLabels,
    DataSlot,
    GuideScreen,
    SlotLabels,
    WizardNote,
    WizardResume,
    WizardPhases,
} from "@/modules/types"

/** Copy, state and commands of the Zalo wizard. */
export interface ZaloWizardBaseProps {
    readonly props: {
        readonly title: string
        readonly stepLabel: string
        readonly steps: ReadonlyArray<string>
        readonly phases: WizardPhases
        readonly index: number
        readonly step: "app" | "follow" | "authorize" | "verify" | "agent"
        /** The stored connection a resumed wizard reads back; a new one is ready at once. */
        readonly resume: DataSlot<WizardResume>
        readonly slotLabels: SlotLabels
        readonly providerHref: string
        readonly appScreens: ReadonlyArray<GuideScreen>
        readonly followScreens: ReadonlyArray<GuideScreen>
        readonly copy: CopyLabels
        /** The three app fields as shown: the typed values, or masks once the connection exists. */
        readonly fields: { readonly name: string; readonly appId: string; readonly appSecret: string }
        readonly isLocked: boolean
        readonly canCreate: boolean
        readonly oaSecretSaved: boolean
        readonly canSaveSecret: boolean
        readonly hasOaSecretInput: boolean
        readonly isAuthorized: boolean
        readonly authorizedNote: string
        /** The sentence for the first message that arrived; null while none has. */
        readonly received: string | null
        readonly agentStep: AgentStepView
        readonly note: WizardNote | null
        readonly isPending: boolean
        readonly text: Readonly<
            Record<
                | "back"
                | "next"
                | "close"
                | "done"
                | "checkLater"
                | "openProvider"
                | "fieldName"
                | "fieldNameHint"
                | "fieldAppId"
                | "fieldAppIdHint"
                | "fieldAppSecret"
                | "createdLocked"
                | "saveOaSecret"
                | "oaSecretSaved"
                | "needSecret"
                | "authorizeBody"
                | "authorize"
                | "reauthorize"
                | "verifyIntro"
                | "verifyWaiting",
                string
            >
        >
    }
    readonly on: {
        readonly retry: () => void
        readonly go: (to: number) => void
        readonly create: () => void
        readonly saveSecret: () => void
        readonly authorize: () => void
        readonly finish: () => void
        readonly close: () => void
        readonly name: (value: string) => void
        readonly appId: (value: string) => void
        readonly appSecret: (value: string) => void
        readonly oaSecret: (value: string) => void
        readonly agents: (ids: ReadonlyArray<string>) => void
    }
}

/** The wizard a new connection starts with: the placeholder drawn while a stored one is read. */
const RESUME_PLACEHOLDER: WizardResume = { isResumed: false }

const actionsOf = ({ props, on }: ZaloWizardBaseProps): ReadonlyArray<WizardAction> => {
    const { text } = props
    const back = backAction(text.back, props.isPending, () => on.go(props.index - 1))
    if (props.step === "app") {
        return [
            forwardAction(text.next, on.create, { isPending: props.isPending, isDisabled: !props.canCreate }),
            closeAction(text.close, on.close),
        ]
    }
    if (props.step === "follow") {
        const label = props.hasOaSecretInput ? text.saveOaSecret : text.next
        return [
            nextAction(label, on.saveSecret, { isPending: props.isPending, isDisabled: !props.canSaveSecret }),
            back,
        ]
    }
    if (props.step === "authorize") {
        const label = props.isAuthorized ? text.reauthorize : text.authorize
        const go = nextAction(label, on.authorize, { isPending: props.isPending })
        const proceed: WizardAction = {
            id: "proceed",
            label: text.next,
            intent: "alternative",
            onPress: () => on.go(3),
        }
        return props.isAuthorized ? [go, proceed, back] : [go, back]
    }
    if (props.step === "verify") {
        const checkLater: WizardAction = {
            id: "checkLater",
            label: text.checkLater,
            intent: "dismiss",
            onPress: () => on.go(4),
        }
        return [props.received === null ? checkLater : forwardAction(text.next, () => on.go(4)), back]
    }
    return [nextAction(text.done, on.finish, { isPending: props.isPending }), back]
}

const appFieldsOf = (props: ZaloWizardBaseProps, isLoading: boolean) => {
    const { props: view, on } = props
    const locked = view.isLocked || view.isPending
    return (
        <Grid kind="form" columns={1}>
            <Input
                id="zalo-name"
                name="name"
                label={view.text.fieldName}
                description={view.text.fieldNameHint}
                isDisabled={locked}
                isLoading={isLoading}
                value={view.fields.name}
                onValueChange={on.name}
            />
            <Input
                id="zalo-appId"
                name="appId"
                label={view.text.fieldAppId}
                description={view.text.fieldAppIdHint}
                isDisabled={locked}
                isLoading={isLoading}
                value={view.fields.appId}
                onValueChange={on.appId}
            />
            <Input
                id="zalo-appSecret"
                name="appSecret"
                label={view.text.fieldAppSecret}
                kind="password"
                isDisabled={locked}
                isLoading={isLoading}
                value={view.fields.appSecret}
                onValueChange={on.appSecret}
            />
        </Grid>
    )
}

/** Zalo OA in the shared wizard frame: app keys, set up the Zalo app, connect the OA, check (message the OA), attach to the agents. */
export const ZaloWizardBase = (props: ZaloWizardBaseProps) => {
    const { props: view, on } = props
    return (
        <SlotView
            slot={view.resume}
            placeholder={RESUME_PLACEHOLDER}
            labels={view.slotLabels}
            onRetry={on.retry}
            render={(_resume, isLoading) => (
                <WizardFrame
                    {...frameOf(view)}
                    phases={view.phases}
                    footer={<WizardFooter actions={actionsOf(props)} isLoading={isLoading} />}
                >
                    <ZaloStepContent {...props} isLoading={isLoading} />
                </WizardFrame>
            )}
        />
    )
}

/** The static provider destination repeated by the app and OA-secret guide steps. */
interface ZaloProviderLinkProps {
    readonly href: string
    readonly label: string
}
const ZaloProviderLink = (props: ZaloProviderLinkProps) => (
    <Cluster gap="inline">
        <Button endArrow intent="neutral" href={props.href} target="_blank" rel="noreferrer">
            {props.label}
        </Button>
    </Cluster>
)

/** The chosen Zalo step and the same resume-read loading atom. */
interface ZaloStepContentProps extends ZaloWizardBaseProps {
    readonly isLoading: boolean
}

/** Owns the unchanged app, OA-secret, authorization, event and agent step content. */
const ZaloStepContent = (props: ZaloStepContentProps) => {
    const { props: view, on, isLoading } = props
    return (
        <>
            {view.step === "app" ? (
                <>
                    <ZaloProviderLink href={view.providerHref} label={view.text.openProvider} />
                    <WizardGuideView
                        screens={view.appScreens}
                        copy={view.copy}
                        onEdit={() => undefined}
                        onPaste={() => undefined}
                        isLoading={isLoading}
                    />
                    {appFieldsOf(props, isLoading)}
                    {view.isLocked ? (
                        <Text size="xs" tone="muted">
                            {view.text.createdLocked}
                        </Text>
                    ) : null}
                </>
            ) : null}
            {view.step === "follow" ? (
                <>
                    <ZaloProviderLink href={view.providerHref} label={view.text.openProvider} />
                    <WizardGuideView
                        screens={view.followScreens}
                        copy={view.copy}
                        isDisabled={view.isPending}
                        onEdit={() => undefined}
                        onPaste={(_, value) => on.oaSecret(value)}
                        isLoading={isLoading}
                    />
                    <Text size="xs" tone="muted">
                        {view.oaSecretSaved ? view.text.oaSecretSaved : view.text.needSecret}
                    </Text>
                </>
            ) : null}
            {view.step === "authorize" ? (
                <>
                    <Text size="sm">{view.text.authorizeBody}</Text>
                    {view.isAuthorized ? (
                        <Alert tone="affirmative" title={view.authorizedNote} isLoading={isLoading} />
                    ) : null}
                </>
            ) : null}
            {view.step === "verify" ? (
                <WizardVerifyStep
                    help={{ intro: view.text.verifyIntro, steps: [] }}
                    received={view.received}
                    waiting={view.text.verifyWaiting}
                    failed={null}
                    isLoading={isLoading}
                />
            ) : null}
            {view.step === "agent" ? (
                <WizardAgentStep
                    {...view.agentStep}
                    isDisabled={view.isPending}
                    onChange={on.agents}
                    isLoading={isLoading}
                />
            ) : null}
            {view.note === null ? null : <Alert tone={view.note.tone} title={view.note.text} isLoading={isLoading} />}
        </>
    )
}
