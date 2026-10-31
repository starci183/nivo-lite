import type { ReactNode } from "react"
import { Alert, Badge, Button, Cluster, Input, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { RowSmtpView } from "@/modules/types"
import { connectionSmtpPanelClassNames as classNames } from "./classNames"

/** What the SMTP-only part of a connection row shows (see RowSmtpView) and the handlers of its commands. */
type ConnectionSmtpPanelProps = RowSmtpView & {
    readonly id: string
    readonly onToggle: (panel: "test" | "password") => void
    readonly onTo: (value: string) => void
    readonly onPassword: (value: string) => void
    readonly onTest: () => void
    readonly onSavePassword: () => void
    readonly onMakeDefault: () => void
    readonly onClose: () => void
}

/** One nested form of the panel: its field and hint, then the confirm and cancel buttons. */
type PanelFormProps = {
    readonly ariaLabel: string
    readonly field: ReactNode
    readonly hint?: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
    readonly isConfirmDisabled: boolean
    readonly onConfirm: () => void
    readonly onCancel: () => void
}

const PanelForm = (props: PanelFormProps) => (
    <div className={classNames.full}>
        <SurfaceCard ariaLabel={props.ariaLabel}>
            <Stack gap="row">
                {props.field}
                {props.hint === undefined ? null : (
                    <Text size="xs" tone="muted">
                        {props.hint}
                    </Text>
                )}
                <Cluster gap="inline">
                    <Button
                        intent="commit"
                        isPending={props.isPending}
                        isDisabled={props.isConfirmDisabled}
                        onPress={props.onConfirm}
                    >
                        {props.confirmLabel}
                    </Button>
                    <Button intent="neutral" onPress={props.onCancel}>
                        {props.cancelLabel}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    </div>
)

/** The SMTP-only part of a connection row: the default badge, send a test, change the password, make it the default. */
export const ConnectionSmtpPanel = (props: ConnectionSmtpPanelProps) => (
    <>
        <Cluster gap="inline">
            {props.isDefault ? <Badge tone="success">{props.labels.defaultBadge}</Badge> : null}
            <Button intent="neutral" isDisabled={props.isPending} onPress={() => props.onToggle("test")}>
                {props.labels.test}
            </Button>
            <Button intent="neutral" isDisabled={props.isPending} onPress={() => props.onToggle("password")}>
                {props.labels.changePassword}
            </Button>
            {props.canSetDefault ? (
                <Button intent="neutral" isDisabled={props.isPending} onPress={props.onMakeDefault}>
                    {props.labels.setDefault}
                </Button>
            ) : null}
        </Cluster>
        {props.panel === "test" ? (
            <PanelForm
                ariaLabel={props.labels.test}
                field={
                    <Input
                        id={`smtp-row-to-${props.id}`}
                        name="testTo"
                        label={props.labels.testTo}
                        isDisabled={props.isPending}
                        value={props.to}
                        onValueChange={props.onTo}
                    />
                }
                confirmLabel={props.labels.testSend}
                cancelLabel={props.labels.cancel}
                isPending={props.isPending}
                isConfirmDisabled={props.to.trim() === ""}
                onConfirm={props.onTest}
                onCancel={props.onClose}
            />
        ) : null}
        {props.panel === "password" ? (
            <PanelForm
                ariaLabel={props.labels.changePassword}
                field={
                    <Input
                        id={`smtp-row-pw-${props.id}`}
                        name="password"
                        label={props.labels.newPassword}
                        kind="password"
                        isDisabled={props.isPending}
                        value={props.password}
                        onValueChange={props.onPassword}
                    />
                }
                hint={props.labels.passwordStored}
                confirmLabel={props.labels.savePassword}
                cancelLabel={props.labels.cancel}
                isPending={props.isPending}
                isConfirmDisabled={props.password.trim() === ""}
                onConfirm={props.onSavePassword}
                onCancel={props.onClose}
            />
        ) : null}
        {props.note === null ? null : (
            <div className={classNames.full}>
                <Alert title={props.note.text} tone={props.note.tone} />
            </div>
        )}
    </>
)
