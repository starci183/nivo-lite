import { Alert, Button, DescriptionList, Drawer, Image, Input, MediaFrame, Text } from "@starci/grammar/common"
import { PAY_CLASS_NAME, QR_CLASS_NAME, QR_WRAP_CLASS_NAME } from "./classNames"

type TransferDetail = {
    readonly id: string
    readonly label: string
    readonly value: string
}

/** The three drawn shapes of the transfer drawer. */
export type PayDrawerShape = "paid" | "expired" | "awaiting"

/** Settled transfer presentation, drawn shape, and actions supplied by the connected drawer; it is mounted only while open. */
type PayDrawerBaseProps = {
    readonly shape: PayDrawerShape
    readonly props: {
        /** True while the order is being made: the drawer shows the waiting notice. */
        readonly isWaiting: boolean
        readonly isRegenerating: boolean
        readonly isBankConfigured: boolean
        readonly hasOrder: boolean
        readonly title: string
        readonly description: string
        readonly closeLabel: string
        readonly paidTitle: string
        readonly paidDescription: string
        readonly waitingLabel: string
        readonly expiredTitle: string
        readonly expiredDescription: string
        readonly errorTitle: string
        readonly regenerateError: string | null
        readonly regenerateLabel: string
        readonly scanLabel: string
        readonly qrAlt: string
        readonly unconfiguredLabel: string
        readonly countdown: string | null
        readonly amountLabel: string
        readonly amount: string
        readonly qrUrl: string
        readonly proration: string | null
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly details: ReadonlyArray<TransferDetail>
        readonly contentWarning: string
    }
    readonly on: {
        readonly close: () => void
        readonly regenerate: () => void
    }
}

/** Draws a paid confirmation, an expired transfer, or copyable bank details with a VietQR code. */
export const PayDrawerBase = (props: PayDrawerBaseProps) => {
    return (
        <Drawer
            title={props.props.title}
            description={props.props.description}
            isOpen
            onOpenChange={(open) => {
                if (!open) props.on.close()
            }}
            closeLabel={props.props.closeLabel}
            placement="right"
            footer={
                <Button intent="neutral" onPress={props.on.close}>
                    {props.props.closeLabel}
                </Button>
            }
        >
            <PaymentContent {...props} />
        </Drawer>
    )
}

/** Renders the PaymentQr section. */
type PaymentQrProps = Pick<PayDrawerBaseProps, "props">

const PaymentQr = (props: PaymentQrProps) => {
    return (
        <div className={QR_WRAP_CLASS_NAME}>
            <Text size="sm" weight="medium">
                {props.props.scanLabel}
            </Text>
            {props.props.isBankConfigured ? (
                <div className={QR_CLASS_NAME}>
                    <MediaFrame aspect="square" fit="contain">
                        <Image
                            src={props.props.qrUrl}
                            alt={props.props.qrAlt}
                            width={256}
                            height={256}
                            aspect="square"
                            fit="contain"
                        />
                    </MediaFrame>
                </div>
            ) : (
                <Alert tone="cautionary" title={props.props.unconfiguredLabel} />
            )}
            {props.props.countdown === null ? null : (
                <Text size="sm" tone="muted">
                    {props.props.countdown}
                </Text>
            )}
        </div>
    )
}

/** Selects the settlement notice or the awaiting transfer details. */
const PaymentContent = (props: PayDrawerBaseProps) => {
    let content
    if (props.props.isWaiting) {
        content = <Alert tone="pending" title={props.props.waitingLabel} urgency="polite" />
    } else if (props.shape === "paid") {
        content = <Alert tone="affirmative" title={props.props.paidTitle} description={props.props.paidDescription} />
    } else if (props.shape === "expired") {
        content = (
            <div className={PAY_CLASS_NAME}>
                {props.props.hasOrder ? (
                    <Alert
                        tone="cautionary"
                        title={props.props.expiredTitle}
                        description={props.props.expiredDescription}
                    />
                ) : null}
                {props.props.regenerateError ? (
                    <Alert tone="negative" title={props.props.errorTitle} description={props.props.regenerateError} />
                ) : null}
                <div>
                    <Button intent="neutral" isPending={props.props.isRegenerating} onPress={props.on.regenerate}>
                        {props.props.regenerateLabel}
                    </Button>
                </div>
            </div>
        )
    } else {
        content = (
            <div className={PAY_CLASS_NAME}>
                <PaymentQr {...props} />
                <DescriptionList
                    layout="stacked"
                    items={[
                        {
                            id: "credits-pay-amount",
                            term: props.props.amountLabel,
                            description: (
                                <Text size="metric-lead" weight="semibold">
                                    {props.props.amount}
                                </Text>
                            ),
                        },
                    ]}
                />
                {props.props.proration === null ? null : (
                    <Text size="sm" tone="muted">
                        {props.props.proration}
                    </Text>
                )}
                {props.props.details.map((detail) => (
                    <Input
                        key={detail.id}
                        id={detail.id}
                        name={detail.id}
                        label={detail.label}
                        value={detail.value}
                        isReadOnly
                        isCopyable
                        copyLabel={props.props.copyLabel}
                        copiedLabel={props.props.copiedLabel}
                    />
                ))}
                <Text size="sm" tone="muted">
                    {props.props.contentWarning}
                </Text>
                <Alert tone="pending" title={props.props.waitingLabel} urgency="polite" />
            </div>
        )
    }

    return content
}
