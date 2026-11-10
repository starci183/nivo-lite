import type { ReactNode } from "react"
import {
    Cluster,
    DropdownMenu,
    IconButton,
    IdentityLockup,
    Link,
    SurfaceCard,
    Tabs,
    type DropdownMenuEntry,
    type SelectItemData,
} from "@starci/grammar/common"

/** The mode control at a row's end: "Tự động | Hỏi". */
export interface CapabilityModeView {
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly onChange: (value: string) => void
}

/** One capability row of a provider card. */
export interface CapabilityRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string | undefined
    readonly isOn: boolean
    readonly isDisabled: boolean
    /** Only a write capability has a mode. */
    readonly mode: CapabilityModeView | undefined
}

/** The ⋯ menu of a provider card ("Gỡ khỏi agent"). */
export interface ProviderMenuView {
    readonly label: string
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** One provider card: its head (logo, name, "type · account"), then its capabilities, or a link to connect it. */
export interface ProviderRightsCardProps {
    readonly props: {
        readonly name: string
        readonly logo: string | undefined
        readonly line: string
        readonly rows: ReadonlyArray<CapabilityRowView>
        readonly menu: ProviderMenuView | undefined
        /** Set when the provider is attached but not connected: the card shows only this link. */
        readonly connectLink: { readonly label: string; readonly href: string } | undefined
    }
    readonly on: {
        readonly toggle: (rowId: string, isOn: boolean) => void
    }
}

/** The pill "Tự động | Hỏi": the primary Tabs of Grammar, off (dimmed) while the capability is off. */
const modeTabs = (row: CapabilityRowView, mode: CapabilityModeView): ReactNode => {
    const [first, second] = mode.options
    if (first === undefined || second === undefined) return null
    return (
        <Tabs
            appearance="primary"
            label={mode.label}
            selectedKey={mode.value}
            onSelect={mode.onChange}
            items={[
                { id: first.id, label: first.label, isDisabled: !row.isOn || row.isDisabled },
                { id: second.id, label: second.label, isDisabled: !row.isOn || row.isDisabled },
            ]}
        />
    )
}

/** One row as a select item: a write ability carries the mode pill at its end (a read ability is the checkbox alone). */
const itemOf = (row: CapabilityRowView): SelectItemData => ({
    id: row.id,
    title: row.title,
    ...(row.subtitle === undefined ? {} : { subtitle: row.subtitle }),
    isDisabled: row.isDisabled,
    ...(row.mode === undefined ? {} : { control: modeTabs(row, row.mode) }),
})

/** The head of a provider card: the logo and name over "type · account", the ⋯ menu at the end. */
const Head = (props: ProviderRightsCardProps["props"]) => (
    <Cluster gap="inline" justify="between" align="center" wrap={false}>
        <IdentityLockup
            title={props.name}
            subtitle={props.line}
            markShape="rounded"
            {...(props.logo === undefined ? {} : { logoSrc: props.logo })}
        />
        {props.connectLink !== undefined ? (
            <Link variant="head" href={props.connectLink.href}>
                {props.connectLink.label}
            </Link>
        ) : props.menu === undefined ? null : (
            <DropdownMenu
                placement="bottom end"
                entries={props.menu.entries}
                trigger={<IconButton glyph="more" label={props.menu.label} size="sm" />}
            />
        )}
    </Cluster>
)

/**
 * One provider of an agent as a card: a head with the provider's logo, name and "type · account" line (and the ⋯ menu, or the link to
 * connect it), then a choice card of the capabilities the agent may use (checkbox rows; a write one also carries its mode).
 */
export const ProviderRightsCard = (card: ProviderRightsCardProps) => {
    const view = card.props
    if (view.connectLink !== undefined) {
        return (
            <SurfaceCard kind="body" ariaLabel={view.name}>
                <Head {...view} />
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard
            kind="select"
            selectionMode="multiple"
            ariaLabel={view.name}
            headers={[{ kind: "custom", children: <Head {...view} /> }]}
            items={view.rows.map(itemOf)}
            value={view.rows.filter((row) => row.isOn).map((row) => row.id)}
            onChange={(keys) => {
                const next = new Set(keys)
                view.rows.forEach((row) => {
                    if (next.has(row.id) !== row.isOn) card.on.toggle(row.id, next.has(row.id))
                })
            }}
        />
    )
}
