import { Alert, Button, Cluster, Image, MediaFrame, Page, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { CelebrationPanel } from "@/components/composites/CelebrationPanel"
import type { CelebrationFact } from "@/components/composites/CelebrationPanel"
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
        /** The paid celebration's status mark and the facts of what was bought. */
        readonly paidBadge: string
        readonly paidFactsLabel: string
        readonly paidFacts: ReadonlyArray<CelebrationFact>
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

/** The unpaid phase's decision: regenerate is the commit, all workspaces the quiet way out. */
const PaymentPendingActions = (props: WorkspacePaymentBaseProps) => (
    <Cluster gap="row">
        <Button intent="commit" isDisabled={!props.props.canRegenerate} onPress={props.on.regenerate}>
            {props.props.regenerateLabel}
        </Button>
        <Button endArrow intent="neutral" href={props.props.allWorkspacesHref}>
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
                <Button endArrow intent="neutral" href={view.allWorkspacesHref}>
                    {view.allWorkspacesLabel}
                </Button>
            </>
        )
    }
    if (view.phase === "expired") return <PaymentExpired {...props} />

    return (
        <>
            {view.error ? <Alert tone="negative" title={view.errorTitle} description={view.error} /> : null}
            {view.details ? <WorkspacePaymentDetails {...view.details} /> : null}
        </>
    )
}

/** What the paid page reads: the copy and facts only, no command beyond the way in. */
type PaymentPaidProps = Pick<WorkspacePaymentBaseProps, "props">

/** The paid page: the purchase celebrated, with what was bought and the way into it. */
const PaymentPaid = (props: PaymentPaidProps) => (
    <Page measure="product">
        <CelebrationPanel
            art="payment-paid"
            badge={props.props.paidBadge}
            heading={props.props.paidTitle}
            text={props.props.paidText}
            isLoading={false}
            factsLabel={props.props.paidFactsLabel}
            facts={props.props.paidFacts}
            nextLabel=""
            next={[]}
            primary={{ label: props.props.openLabel, href: props.props.returnTo }}
        />
    </Page>
)

/** The payment page while it is not yet paid: the header band with its trail, then the payment progress, an error, or an expired code. */
const PaymentProgress = (props: WorkspacePaymentBaseProps) => (
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

/** Draws the payment page without reading data: a celebration once paid, otherwise its progress. */
export const WorkspacePaymentBase = (props: WorkspacePaymentBaseProps) =>
    props.props.phase === "paid" ? <PaymentPaid props={props.props} /> : <PaymentProgress {...props} />

/** An expired code: the waiting art, what happened, and a fresh code or the way out. */
const PaymentExpired = (props: WorkspacePaymentBaseProps) => {
    const view = props.props
    return (
        <SurfaceCard label={view.expiredTitle} headingLevel={2}>
            <div className={CENTERED_CLASS_NAME}>
                <Stack gap="section" align="center">
                    <div className={ART_CLASS_NAME}>
                        <MediaFrame
                            treatment="plain"
                            aspect="square"
                            fit="contain"
                            media={<Image src="/images/promo/payment-waiting-3d.webp" alt="" aspect="square" fit="contain" plate="none" />}
                        />
                    </div>
                    <Text>{view.expiredText}</Text>
                    {view.error ? <Alert tone="negative" title={view.errorTitle} description={view.error} /> : null}
                    <PaymentPendingActions {...props} />
                </Stack>
            </div>
        </SurfaceCard>
    )
}
