import { Alert, Button, Cluster, Image, MediaFrame, Page, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { WorkspacePaymentDetails } from "@/components/composites/WorkspacePaymentDetails"
import type { WorkspacePaymentDetailsProps } from "@/components/composites/WorkspacePaymentDetails"
import { CENTERED_CLASS_NAME, ART_CLASS_NAME, MEASURE_CLASS_NAME } from "./classNames"

/** Presentation of a payment step after the connected block resolves its state. */
export interface WorkspacePaymentBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        /** The trail: the page above and its words. */
        readonly crumbLabel: string
        readonly crumbHomeLabel: string
        readonly crumbHomeHref: string
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

/** The paid outcome's one command: open what was paid for. */
type PaymentPaidActionProps = Pick<WorkspacePaymentBaseProps, "props">

const PaymentPaidAction = (props: PaymentPaidActionProps) => (
    <Button intent="commit" href={props.props.returnTo}>
        {props.props.openLabel}
    </Button>
)

/** The unpaid phase's decision: regenerate is the commit, all workspaces the quiet way out. */
const PaymentPendingActions = (props: WorkspacePaymentBaseProps) => (
    <Cluster gap="row">
        <Button intent="commit" isDisabled={!props.props.canRegenerate} onPress={props.on.regenerate}>
            {props.props.regenerateLabel}
        </Button>
        <Button intent="neutral" href={props.props.allWorkspacesHref}>
            {props.props.allWorkspacesLabel}
        </Button>
    </Cluster>
)

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
            {view.error ? <Alert tone="negative" title={view.errorTitle} description={view.error} /> : null}
            {view.details ? <WorkspacePaymentDetails {...view.details} /> : null}
        </>
    )
}

/** Draws the payment page without reading data: the header band with its trail, then the payment progress, a paid outcome, or an expired code. */
export const WorkspacePaymentBase = (props: WorkspacePaymentBaseProps) => (
    <Page
        measure="product"
        isLoading={props.props.phase === "loading" || props.props.phase === "creating"}
        header={{
            breadcrumbs: {
                label: props.props.crumbLabel,
                items: [
                    { id: "workspaces", label: props.props.crumbHomeLabel, href: props.props.crumbHomeHref },
                    { id: "payment", label: props.props.title },
                ],
            },
            title: props.props.title,
            description: props.props.description === "" ? undefined : props.props.description,
        }}
    >
        <div className={MEASURE_CLASS_NAME}>
            <Stack gap="section">
                <PaymentSituation {...props} />
            </Stack>
        </div>
    </Page>
)

/** The settled payment result retains its heading and exposes the result as output. */
const PaymentOutcome = (props: WorkspacePaymentBaseProps) => {
    const view = props.props
    const paid = view.phase === "paid"
    const title = paid ? view.paidTitle : view.expiredTitle
    const description = paid ? view.paidText : view.expiredText
    const art = paid ? "/images/promo/payment-paid-3d.webp" : "/images/promo/payment-waiting-3d.webp"
    return (
        <SurfaceCard label={title} headingLevel={2}>
            <div className={CENTERED_CLASS_NAME}>
                <Stack gap="section" align="center">
                    <div className={ART_CLASS_NAME}>
                        <MediaFrame
                            treatment="plain"
                            aspect="square"
                            fit="contain"
                            media={<Image src={art} alt="" aspect="square" fit="contain" plate="none" />}
                        />
                    </div>
                    <Text>{description}</Text>
                    {view.error ? <Alert tone="negative" title={view.errorTitle} description={view.error} /> : null}
                    {paid ? <PaymentPaidAction {...props} /> : <PaymentPendingActions {...props} />}
                </Stack>
            </div>
        </SurfaceCard>
    )
}
