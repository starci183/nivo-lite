import { Alert, Image, Input, MediaFrame, ProgressCircle, SurfaceCard, Text } from "@starci/grammar/common"
import {
    COPY_CLASS_NAME,
    COUNTDOWN_CLASS_NAME,
    DETAILS_CLASS_NAME,
    FIELDS_CLASS_NAME,
    GRID_CLASS_NAME,
    QR_CLASS_NAME,
    QR_WRAP_CLASS_NAME,
} from "./classNames"

/** Localized transfer instructions and server-provided bank data. */
export interface WorkspacePaymentDetailsProps {
    readonly title: string
    readonly scanTitle: string
    readonly qrAlt: string
    readonly qrUrl: string
    readonly bank: { readonly account: string; readonly bank: string; readonly holder: string }
    readonly fields: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: string }>
    readonly copyLabel: string
    readonly copiedLabel: string
    readonly countdownLabel?: string | undefined
    readonly countdownProgress?: number | undefined
    readonly amountLabel: string
    readonly amount: string
    readonly contentWarning: string
    readonly waitingLabel: string
    readonly trustLabel: string
    readonly notConfiguredLabel: string
}

/** QR and exact transfer details from the payment order query. */
export const WorkspacePaymentDetails = (props: WorkspacePaymentDetailsProps) => (
    <SurfaceCard ariaLabel={props.title}>
        <div className={GRID_CLASS_NAME}>
            <div className={QR_WRAP_CLASS_NAME}>
                <Text size="sm" weight="medium">
                    {props.scanTitle}
                </Text>
                {props.bank.account && props.bank.bank ? (
                    <div className={QR_CLASS_NAME}>
                        <MediaFrame aspect="square" fit="contain">
                            <Image
                                src={props.qrUrl}
                                alt={props.qrAlt}
                                width={256}
                                height={256}
                                aspect="square"
                                fit="contain"
                            />
                        </MediaFrame>
                    </div>
                ) : (
                    <Alert tone="cautionary" title={props.notConfiguredLabel} />
                )}
                {props.countdownLabel && props.countdownProgress !== undefined ? (
                    <div className={COUNTDOWN_CLASS_NAME}>
                        <ProgressCircle label={props.countdownLabel} value={props.countdownProgress} />
                        <Text size="sm" tone="muted">
                            {props.countdownLabel}
                        </Text>
                    </div>
                ) : null}
            </div>
            <div className={DETAILS_CLASS_NAME}>
                <div className={COPY_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {props.amountLabel}
                    </Text>
                    <Text size="metric-lead" weight="semibold">
                        {props.amount}
                    </Text>
                </div>
                <div className={FIELDS_CLASS_NAME}>
                    {props.fields.map((field) => (
                        <Input
                            key={field.id}
                            id={field.id}
                            name={field.id}
                            label={field.label}
                            variant="secondary"
                            value={field.value}
                            isReadOnly
                            isCopyable
                            copyLabel={props.copyLabel}
                            copiedLabel={props.copiedLabel}
                        />
                    ))}
                </div>
                <Text size="sm" tone="muted">
                    {props.contentWarning}
                </Text>
                <Alert tone="pending" title={props.waitingLabel} urgency="polite" />
                <Text size="sm" tone="muted">
                    {props.trustLabel}
                </Text>
            </div>
        </div>
    </SurfaceCard>
)
