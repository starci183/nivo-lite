import { Alert, AlertDialog, Stack, Text, type DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionAccessMenu } from "@/components/composites/ConnectionAccessMenu"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { ConnectionSmtpPanel } from "@/components/composites/ConnectionSmtpPanel"
import type { RowDialog, RowPrimary, RowView } from "@/modules/types"

/** The commands a connection's detail, menu and dialogs give. */
export interface RowCommandSet {
    readonly primary: (id: RowPrimary["id"]) => void
    readonly menu: (id: string) => void
    readonly pick: (agentId: string, value: string) => void
    readonly dialog: (kind: "disconnect" | "remove", action: "confirm" | "cancel") => void
    readonly smtpToggle: (panel: "test" | "password") => void
    readonly smtpTo: (value: string) => void
    readonly smtpPassword: (value: string) => void
    readonly smtpTest: () => void
    readonly smtpSavePassword: () => void
    readonly smtpMakeDefault: () => void
    readonly smtpClose: () => void
}

/** The menu entries of a connection: the editing commands first, the destructive one last. */
export const rowMenuEntriesOf = (view: RowView, onMenu: (id: string) => void): ReadonlyArray<DropdownMenuEntry> =>
    view.menu.map((section) => ({
        kind: "section" as const,
        id: section.id,
        items: section.items.map((item) => ({
            id: item.id,
            label: item.label,
            ...(item.tone === undefined ? {} : { tone: item.tone }),
            onAction: () => onMenu(item.id),
        })),
    }))

/** The question one destructive command asks first. */
const questionOf = (kind: "disconnect" | "remove", dialog: RowDialog, on: RowCommandSet) => (
    <AlertDialog
        isOpen={dialog.isOpen}
        onOpenChange={(open) => {
            if (!open) on.dialog(kind, "cancel")
        }}
        tone="negative"
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        onConfirm={() => on.dialog(kind, "confirm")}
        isConfirmPending={dialog.isPending}
    />
)

/** What the detail of a connection draws. */
interface ConnectionRowBodyProps {
    readonly view: RowView
    readonly on: RowCommandSet
    /** The access picker is part of the detail pane; a row inside a drawer keeps it beside its buttons. */
    readonly withAccess?: boolean
}

/** What a connection says beyond its name: alerts, notes, the SMTP panel, the keys, the last note, and the two destructive questions. */
export const ConnectionRowBody = (props: ConnectionRowBodyProps) => {
    const { view, on } = props
    return (
        <Stack gap="row">
            {props.withAccess !== true || view.access === null ? null : (
                <ConnectionAccessMenu {...view.access} onPick={on.pick} />
            )}
            {view.alerts.map((alert) => (
                <Alert key={alert.id} tone={alert.tone} title={alert.title} description={alert.description} />
            ))}
            {view.notes.map((note) => (
                <Text key={note} size="xs" tone="muted">
                    {note}
                </Text>
            ))}
            {view.smtp === null ? null : (
                <ConnectionSmtpPanel
                    {...view.smtp}
                    id={view.id}
                    onToggle={on.smtpToggle}
                    onTo={on.smtpTo}
                    onPassword={on.smtpPassword}
                    onTest={on.smtpTest}
                    onSavePassword={on.smtpSavePassword}
                    onMakeDefault={on.smtpMakeDefault}
                    onClose={on.smtpClose}
                />
            )}
            {view.keys === null ? null : (
                <Stack gap="row">
                    <ConnectionCopyInput
                        id={`row-${view.id}-url`}
                        name="webhookUrl"
                        label={view.keys.urlLabel}
                        value={view.keys.url}
                        labels={view.copy}
                    />
                    <ConnectionCopyInput
                        id={`row-${view.id}-key`}
                        name="apiKey"
                        label={view.keys.keyLabel}
                        value={view.keys.key}
                        isSecret
                        labels={view.copy}
                    />
                </Stack>
            )}
            {view.note === null ? null : <Alert title={view.note.text} tone={view.note.tone} />}
            {questionOf("disconnect", view.disconnect, on)}
            {questionOf("remove", view.remove, on)}
        </Stack>
    )
}
