import { Alert, AlertDialog, Stack, Text } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { ConnectionSmtpPanel } from "@/components/composites/ConnectionSmtpPanel"
import type { RowDialog, RowPrimary, RowView } from "@/modules/types"

/** The commands a connection's detail, menu and dialogs give. */
export interface RowCommandSet {
    readonly primary: (id: RowPrimary["id"]) => void
    readonly menu: (id: string) => void
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

/** What the two destructive questions of a connection read. */
interface ConnectionRowQuestionsProps {
    readonly view: RowView
    readonly on: RowCommandSet
}

/** The two questions a connection's destructive commands ask first (disconnect, remove); drawn in a portal, so they take no room. */
export const ConnectionRowQuestions = (props: ConnectionRowQuestionsProps) => (
    <>
        {questionOf("disconnect", props.view.disconnect, props.on)}
        {questionOf("remove", props.view.remove, props.on)}
    </>
)

/** What the detail of a connection draws. */
interface ConnectionRowBodyProps {
    readonly view: RowView
    readonly on: RowCommandSet
    /** The page's band draws the two questions (its menu opens them); a row inside a drawer keeps them here. */
    readonly withoutQuestions?: boolean
}

/** Whether the connection says anything beyond its name (the two questions aside). */
const hasContent = (view: RowView): boolean =>
    view.alerts.length > 0 || view.notes.length > 0 || view.smtp !== null || view.keys !== null || view.note !== null

/**
 * What a connection says beyond its name: alerts, notes, the SMTP panel, the keys, the last note, and the two destructive questions.
 * Nothing at all when there is nothing to say and the questions live elsewhere, so the page keeps no empty slot.
 */
export const ConnectionRowBody = (props: ConnectionRowBodyProps) => {
    const { view, on } = props
    if (props.withoutQuestions === true && !hasContent(view)) return null
    return (
        <Stack gap="row">
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
                <Stack gap="inline">
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
            {props.withoutQuestions === true ? null : <ConnectionRowQuestions view={view} on={on} />}
        </Stack>
    )
}
