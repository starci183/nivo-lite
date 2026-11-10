import type { ReactElement } from "react"
import {
    AlertDialog,
    Badge,
    Button,
    Cluster,
    DescriptionList,
    Drawer,
    DropdownMenu,
    Heading,
    IconButton,
    Quote,
    Stack,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { FactDrawerDetailView } from "@/modules/types"

/** Props for {@link FactDetailDrawer}. */
interface FactDetailDrawerProps {
    readonly props: {
        /** The fact open; null while the drawer is closed. */
        readonly view: FactDrawerDetailView | null
    }
    readonly on: {
        readonly close: () => void
        readonly edit: () => void
        readonly approve: () => void
        readonly reject: () => void
        readonly menu: (id: string) => void
        readonly confirmRetire: () => void
        readonly cancelRetire: () => void
    }
}

/** What a part of the open drawer reads. */
interface ViewProps {
    readonly view: FactDrawerDetailView
}

/** What the foot of the open drawer draws and does. */
interface FooterProps extends ViewProps {
    readonly on: FactDetailDrawerProps["on"]
}

/**
 * The foot of the drawer, in the canon order: the menu of rare commands (the history, then stopping the value, last and in the danger
 * tone) and Reject at the start; Edit value, then Approve, the one primary, at the end.
 */
const Footer = (props: FooterProps) => {
    const { view, on } = props
    return (
        <Cluster gap="inline" justify="between" align="center">
            <Cluster gap="inline">
                <DropdownMenu
                    placement="top start"
                    entries={view.menu.entries.map((entry) => ({ id: entry.id, label: entry.label, tone: entry.tone }))}
                    onAction={on.menu}
                    trigger={
                        <IconButton
                            intent="neutral"
                            source={nivoIconSource("more", "leading")}
                            label={view.menu.label}
                        />
                    }
                />
                {view.reject === null ? null : (
                    <Button intent="dismiss" isPending={view.reject.isPending} onPress={on.reject}>
                        {view.reject.label}
                    </Button>
                )}
            </Cluster>
            <Cluster gap="inline">
                {view.edit === null ? null : (
                    <Button intent="neutral" onPress={on.edit}>
                        {view.edit.label}
                    </Button>
                )}
                {view.approve === null ? null : (
                    <Button intent="commit" isPending={view.approve.isPending} onPress={on.approve}>
                        {view.approve.label}
                    </Button>
                )}
            </Cluster>
        </Cluster>
    )
}

/** The values the fact had, when the reader asked for them. */
const History = (props: ViewProps): ReactElement | null =>
    props.view.history === null ? null : (
        <Stack gap="row">
            <Heading level={3}>{props.view.historyTitle}</Heading>
            {props.view.history.map((one) => (
                <Cluster key={one.id} gap="inline" justify="between" wrap={false}>
                    <Text isStrong>{one.value}</Text>
                    <Text size="xs" tone="muted">
                        {one.line}
                    </Text>
                </Cluster>
            ))}
        </Stack>
    )

/** The value large, with where it stands and how far it is believed. */
const Value = (props: ViewProps) => (
    <Stack gap="row">
        <Text size="xs" tone="muted">
            {props.view.valueLabel}
        </Text>
        <Heading level={3} scale="display">
            {props.view.value}
        </Heading>
        <Cluster gap="inline">
            {props.view.badges.map((badge) => (
                <Badge key={badge.label} tone={badge.tone}>
                    {badge.label}
                </Badge>
            ))}
        </Cluster>
    </Stack>
)

/**
 * The detail of one fact in a drawer: the value large with where it stands and how far it is believed, the words it was quoted in, its
 * terms (who reads it, where it came from), its history on demand, and the commands at the foot. Stopping a value asks first.
 */
export const FactDetailDrawer = (props: FactDetailDrawerProps): ReactElement | null => {
    const { view } = props.props
    const { on } = props
    if (view === null) return null
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={view.title}
            description={view.description}
            closeLabel={view.closeLabel}
            placement="right"
            footer={<Footer view={view} on={on} />}
        >
            <Stack gap="section">
                <Value view={view} />
                {view.quote === null ? null : (
                    <Stack gap="row">
                        <Heading level={3}>{view.quoteTitle}</Heading>
                        <Quote text={view.quote.text} byline={view.quote.source} />
                    </Stack>
                )}
                <DescriptionList
                    density="compact"
                    items={view.terms.map((term) => ({ id: term.id, term: term.term, description: term.text }))}
                />
                <History view={view} />
            </Stack>
            {view.retire === null ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) on.cancelRetire()
                    }}
                    tone={view.retire.tone}
                    title={view.retire.title}
                    description={view.retire.description}
                    confirmLabel={view.retire.confirmLabel}
                    cancelLabel={view.retire.cancelLabel}
                    onConfirm={on.confirmRetire}
                />
            )}
        </Drawer>
    )
}
