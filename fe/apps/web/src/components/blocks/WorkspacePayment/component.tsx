import { Alert, Button, Image, MediaFrame, SectionHeader, Stepper, SurfaceCard } from "@starci/grammar/common"
import { WorkspacePaymentDetails } from "@/components/composites/WorkspacePaymentDetails"
import type { WorkspacePaymentDetailsProps } from "@/components/composites/WorkspacePaymentDetails"
import { ACTIONS_CLASS_NAME, CENTERED_CLASS_NAME, MASCOT_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** Presentation of a payment step after the connected block resolves its state. */
export interface WorkspacePaymentBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly steps: ReadonlyArray<string>
        readonly phase: "loading" | "creating" | "paid" | "expired" | "pending" | "missing" | "error"
        readonly loadingLabel: string
        readonly creatingLabel: string
        readonly paidTitle: string
        readonly paidText: string
        readonly expiredTitle: string
        readonly expiredText: string
        readonly regenerateLabel: string
        readonly allWorkspacesLabel: string
        readonly allWorkspacesHref: string
        readonly openLabel: string
        readonly returnTo: string
        readonly errorTitle: string
        readonly missingTitle: string
        readonly error?: string | undefined
        readonly canRegenerate: boolean
        readonly details?: WorkspacePaymentDetailsProps | undefined
    }
    readonly on: {
        readonly regenerate: () => void
    }
}

const PaymentActions = (props: WorkspacePaymentBaseProps) => {
    if (props.props.phase === "paid") {
        return (
            <Button intent="commit" href={props.props.returnTo}>
                {props.props.openLabel}
            </Button>
        )
    }
    return (
        <>
            <Button intent="commit" isDisabled={!props.props.canRegenerate} onPress={props.on.regenerate}>
                {props.props.regenerateLabel}
            </Button>
            <Button intent="neutral" href={props.props.allWorkspacesHref}>
                {props.props.allWorkspacesLabel}
            </Button>
        </>
    )
}

const PaymentSituation = (props: WorkspacePaymentBaseProps) => {
    const view = props.props
    if (view.phase === "loading" || view.phase === "creating") {
        return <Alert tone="pending" title={view.phase === "creating" ? view.creatingLabel : view.loadingLabel} />
    }
    if (view.phase === "error" || view.phase === "missing") {
        return (
            <>
                <Alert
                    tone="negative"
                    title={view.phase === "missing" ? view.missingTitle : view.errorTitle}
                    description={view.error}
                />
                <Button intent="neutral" href={view.allWorkspacesHref}>
                    {view.allWorkspacesLabel}
                </Button>
            </>
        )
    }
    if (view.phase === "paid" || view.phase === "expired") return <PaymentOutcome {...props} />

    return (
        <>
            <SectionHeader level={1} title={view.title} description={view.description} />
            {view.error ? <Alert tone="negative" title={view.errorTitle} description={view.error} /> : null}
            {view.details ? <WorkspacePaymentDetails {...view.details} /> : null}
        </>
    )
}

/** Draws payment progress, a paid outcome, or an expired code without reading data. */
export const WorkspacePaymentBase = (props: WorkspacePaymentBaseProps) => (
    <div className={STACK_CLASS_NAME}>
        <Stepper
            label={props.props.title}
            steps={props.props.steps.map((label, index) => ({ id: `step-${index + 1}`, label }))}
            currentStepId="step-3"
        />
        <PaymentSituation {...props} />
    </div>
)

/** The settled payment result retains its heading and exposes the result as output. */
const PaymentOutcome = (props: WorkspacePaymentBaseProps) => {
    const view = props.props
    const paid = view.phase === "paid"
    const title = paid ? view.paidTitle : view.expiredTitle
    const description = paid ? view.paidText : view.expiredText
    const mascot = paid ? "/images/promo/mascot-celebrate.png" : "/images/promo/mascot-night.png"
    return (
        <SurfaceCard ariaLabel={title}>
            <div className={CENTERED_CLASS_NAME}>
                <div className={MASCOT_CLASS_NAME}>
                    <MediaFrame treatment="plain" aspect="portrait" fit="contain">
                        <Image src={mascot} alt="" aspect="portrait" fit="contain" plate="none" />
                    </MediaFrame>
                </div>
                <SectionHeader level={1} title={paid ? <output>{title}</output> : title} description={description} />
                {view.error ? <Alert tone="negative" title={view.errorTitle} description={view.error} /> : null}
                <div className={ACTIONS_CLASS_NAME}>
                    <PaymentActions {...props} />
                </div>
            </div>
        </SurfaceCard>
    )
}
