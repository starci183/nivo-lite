import {
    Alert,
    AlertDialog,
    Badge,
    Button,
    Cluster,
    DropdownMenu,
    IconButton,
    Link,
    Stack,
    Text,
} from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionAccessMenu } from "@/components/composites/ConnectionAccessMenu"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { ConnectionSmtpPanel } from "@/components/composites/ConnectionSmtpPanel"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { RowDialog, RowPrimary, RowView } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

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

const plainFactsOf = (view: RowView): string | undefined => {
    const text = [view.facts, view.usedBy].filter(Boolean).join(" · ")
    return text === "" ? undefined : text
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
    </>
)

/** A connection's detail body; its collection owner carries the id and name while this block keeps its own state and commands. */
export const ConnectionRowBase = (props: ConnectionRowBaseProps) => {
    const view = props.props
    const on = props.on
    const entries = entriesOf(view, on.menu)
    const primary = view.primary
    const factsLine = view.telegramHandle === null ? plainFactsOf(view) : view.usedBy
    const hasDetails =
        view.alerts.length + view.notes.length > 0 || view.smtp !== null || view.keys !== null || view.note !== null
    return (
        <Stack gap="row">
            <Cluster gap="inline" align="center">
                {primary === null ? null : (
                    <Button
                        intent={primary.intent}
                        isPending={primary.isPending}
                        onPress={() => on.primary(primary.id)}
                    >
                        {primary.label}
                    </Button>
                )}
                {view.page === null ? null : (
                    <Button intent="neutral" href={view.page.href}>
                        {view.page.label}
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
                                intent="neutral"
                                isDisabled={view.menuIsDisabled}
                            />
                        }
                        entries={entries}
                    />
                )}
            </Cluster>
            <Stack gap="row">
                <Cluster gap="inline" align="center">
                    <ProviderLogo {...view.logo} glyph="email" />
                    <Badge isDot tone={view.statusTone}>
                        {view.statusLabel}
                    </Badge>
                    {view.envLabel === null ? null : <Badge tone="neutral">{view.envLabel}</Badge>}
                    {view.telegramHandle === null ? null : (
                        <Link kind="external" href={`https://t.me/${view.telegramHandle}`}>
                            {`@${view.telegramHandle}`}
                        </Link>
                    )}
                </Cluster>
                {factsLine ? (
                    <Text size="sm" tone="muted">
                        {factsLine}
                    </Text>
                ) : null}
                {hasDetails ? detailsOf(view, on) : null}
            </Stack>
            {dialogOf("disconnect", view.disconnect, on)}
            {dialogOf("remove", view.remove, on)}
        </Stack>
    )
}
