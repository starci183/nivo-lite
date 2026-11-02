import {
    Alert,
    Cluster,
    DescriptionList,
    Heading,
    Image,
    Input,
    MediaFrame,
    ProgressCircle,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { DETAILS_CLASS_NAME, GRID_CLASS_NAME, QR_CLASS_NAME } from "./classNames"

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
            <Stack gap="row" align="center">
                <Heading level={2}>{props.scanTitle}</Heading>
                {props.bank.account && props.bank.bank ? (
                    <div className={QR_CLASS_NAME}>
                        <MediaFrame
                            aspect="square"
                            fit="contain"
                            media={
                                <Image
                                    src={props.qrUrl}
                                    alt={props.qrAlt}
                                    width={256}
                                    height={256}
                                    aspect="square"
                                    fit="contain"
                                />
                            }
                        />
                    </div>
                ) : (
                    <Alert tone="cautionary" title={props.notConfiguredLabel} />
                )}
                {props.countdownLabel && props.countdownProgress !== undefined ? (
                    <Cluster gap="row">
                        <ProgressCircle label={props.countdownLabel} value={props.countdownProgress} />
                        <Text size="sm" tone="muted">
                            {props.countdownLabel}
                        </Text>
                    </Cluster>
                ) : null}
            </Stack>
            <div className={DETAILS_CLASS_NAME}>
                <Stack gap="row">
                    <DescriptionList items={[{ id: "amount", term: props.amountLabel, description: props.amount }]} />
                    <Stack gap="row">
                        {props.fields.map((field) => (
                            <Input
                                key={field.id}
                                id={field.id}
                                name={field.id}
                                label={field.label}
                                value={field.value}
                                isReadOnly
                                isCopyable
                                copyLabel={props.copyLabel}
                                copiedLabel={props.copiedLabel}
                            />
                        ))}
                    </Stack>
                    <Text size="sm" tone="muted">
                        {props.contentWarning}
                    </Text>
                    <Alert tone="pending" title={props.waitingLabel} urgency="polite" />
                    <Text size="sm" tone="muted">
                        {props.trustLabel}
                    </Text>
                </Stack>
            </div>
        </div>
    </SurfaceCard>
)
