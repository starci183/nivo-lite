import {
    Alert,
    AlertDialog,
    Badge,
    Button,
    DropdownMenu,
    IconButton,
    ListRow,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionAccessMenu } from "@/components/composites/ConnectionAccessMenu"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { ConnectionSmtpPanel } from "@/components/composites/ConnectionSmtpPanel"
import { ProviderLogo } from "@/components/leaves/ProviderLogo"
import type { RowDialog, RowPrimary, RowView } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"
import { connectionRowClassNames as classNames } from "./classNames"

/** What a connection row draws and the commands the owner can give it. */
export interface ConnectionRowBaseProps {
    readonly props: RowView
    readonly on: {
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
}

type RowHandlers = ConnectionRowBaseProps["on"]

const entriesOf = (view: RowView, onMenu: (id: string) => void): ReadonlyArray<DropdownMenuEntry> =>
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

const factsOf = (view: RowView) => {
    const text = [view.facts, view.usedBy].filter(Boolean).join(" · ")
    if (view.telegramHandle === null) return text === "" ? undefined : text
    return (
        <>
            <TextAction
                href={`https://t.me/${view.telegramHandle}`}
                target="_blank"
            >{`@${view.telegramHandle}`}</TextAction>
            {view.usedBy === "" ? "" : ` · ${view.usedBy}`}
        </>
    )
}

const dialogOf = (kind: "disconnect" | "remove", dialog: RowDialog, on: RowHandlers) => (
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

const detailsOf = (view: RowView, on: RowHandlers) => (
    <>
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
            <div className={classNames.full}>
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
            </div>
        )}
        {view.note === null ? null : <Alert title={view.note.text} tone={view.note.tone} />}
    </>
)

/** One connection as a list row: name and status, one facts line, an alert only when something needs acting on, one visible action, the rest in its menu. */
export const ConnectionRowBase = (props: ConnectionRowBaseProps) => {
    const view = props.props
    const on = props.on
    const entries = entriesOf(view, on.menu)
    const primary = view.primary
    const hasDetails =
        view.alerts.length + view.notes.length > 0 || view.smtp !== null || view.keys !== null || view.note !== null
    return (
        <ListRow
            leading={<ProviderLogo {...view.logo} glyph="email" />}
            title={view.title}
            badges={
                <>
                    <Badge isDot tone={view.statusTone}>
                        {view.statusLabel}
                    </Badge>
                    {view.envLabel === null ? null : <Badge tone="neutral">{view.envLabel}</Badge>}
                </>
            }
            description={factsOf(view)}
            state={view.state}
            actions={
                <>
                    {primary === null ? null : (
                        <Button
                            variant={primary.variant}
                            isPending={primary.isPending}
                            onPress={() => on.primary(primary.id)}
                        >
                            {primary.label}
                        </Button>
                    )}
                    {view.access === null ? null : <ConnectionAccessMenu {...view.access} onPick={on.pick} />}
                    {entries.length === 0 ? null : (
                        <DropdownMenu
                            placement="bottom end"
                            trigger={
                                <IconButton
                                    source={nivoIconSource("more", "leading")}
                                    label={view.menuLabel}
                                    variant="ghost"
                                    isDisabled={view.menuIsDisabled}
                                />
                            }
                            entries={entries}
                        />
                    )}
                    {dialogOf("disconnect", view.disconnect, on)}
                    {dialogOf("remove", view.remove, on)}
                </>
            }
        >
            {hasDetails ? detailsOf(view, on) : undefined}
        </ListRow>
    )
}
