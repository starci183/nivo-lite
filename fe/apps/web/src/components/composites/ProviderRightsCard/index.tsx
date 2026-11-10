import {
    Cluster,
    DropdownMenu,
    IconButton,
    IdentityLockup,
    Link,
    SurfaceCard,
    Tabs,
    type SelectItemData,
} from "@starci/grammar/common"
import type { CapabilityModeView, CapabilityRowView, ProviderHeadView, ProviderRightsCardProps } from "./types"

export { abilityRowsOf, toggleAbility } from "./rows"
export type { RightsTranslate } from "./rows"
export type { ProviderRightsCardProps } from "./types"

/** A read ability row: the checkbox alone. */
const readItemOf = (row: CapabilityRowView): SelectItemData => ({
    id: row.id,
    title: row.title,
    ...(row.subtitle === undefined ? {} : { subtitle: row.subtitle }),
    isDisabled: row.isDisabled,
})

/** A write ability row: the checkbox and, at its end, the mode pill (Grammar primary Tabs, dimmed while the ability is off). */
const writeItemOf = (row: CapabilityRowView, mode: CapabilityModeView): SelectItemData => ({
    ...readItemOf(row),
    control: (
        <Tabs
            appearance="primary"
            label={mode.label}
            selectedKey={mode.value}
            onSelect={mode.onChange}
            items={[
                { id: mode.options[0].id, label: mode.options[0].label, isDisabled: !row.isOn },
                { id: mode.options[1].id, label: mode.options[1].label, isDisabled: !row.isOn },
            ]}
        />
    ),
})

/** One row as a select item. */
const itemOf = (row: CapabilityRowView): SelectItemData => (row.mode === undefined ? readItemOf(row) : writeItemOf(row, row.mode))

/** The input of the head parts. */
interface HeadInput {
    readonly head: ProviderHeadView
}

/** What stands at the end of the head: the link to connect, the more-menu, or nothing. */
const HeadEnd = ({ head }: HeadInput) => {
    if (head.connectLink !== undefined) {
        return (
            <Link variant="head" href={head.connectLink.href}>
                {head.connectLink.label}
            </Link>
        )
    }
    if (head.menu === undefined) return null
    return (
        <DropdownMenu
            placement="bottom end"
            entries={head.menu.entries}
            trigger={<IconButton glyph="more" intent="neutral" label={head.menu.label} size="sm" />}
        />
    )
}

/** The head of a provider card: the logo and name over the kind line, the end of the head at the end. */
const Head = ({ head }: HeadInput) => (
    <Cluster gap="inline" justify="between" align="center" wrap={false}>
        <IdentityLockup
            title={head.name}
            subtitle={head.line}
            markShape="rounded"
            {...(head.logo === undefined ? {} : { logoSrc: head.logo })}
        />
        <HeadEnd head={head} />
    </Cluster>
)

/**
 * One provider of an agent as a card: a head with the provider's logo, name and kind line (and the more-menu, or the link to
 * connect it), then a choice card of the capabilities the agent may use (checkbox rows; a write one also carries its mode).
 */
export const ProviderRightsCard = (props: ProviderRightsCardProps) => {
    const view = props.props
    if (view.connectLink !== undefined) {
        return (
            <SurfaceCard kind="body" ariaLabel={view.name}>
                <Head head={view} />
            </SurfaceCard>
        )
    }
    const items = view.rows.map((row) => itemOf(row))
    return (
        <SurfaceCard
            kind="select"
            selectionMode="multiple"
            ariaLabel={view.name}
            headers={[{ kind: "custom", children: <Head head={view} /> }]}
            items={items}
            value={view.rows.filter((row) => row.isOn).map((row) => row.id)}
            onChange={(keys) => {
                const next = new Set(keys)
                view.rows.forEach((row) => {
                    if (next.has(row.id) !== row.isOn) props.on.toggle(row.id, next.has(row.id))
                })
            }}
        />
    )
}
