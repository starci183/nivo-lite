import { Badge, EmptyNotice, ListBox, SurfaceCard, type ListBoxSection } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { nivoIconSource } from "@/components/leaves/Icon"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import type { DataSlot, SandboxAccountsData, SandboxCopy } from "@/modules/types"

/** What the accounts card draws and does. */
interface SandboxAccountsCardProps {
    readonly copy: SandboxCopy
    readonly slot: DataSlot<SandboxAccountsData>
    readonly onSelect: (accountId: string) => void
    readonly onRetry: () => void
}

/** The card while the accounts are read: one provider with three rows of the shape of the real ones. */
const PLACEHOLDER: SandboxAccountsData = {
    groups: [
        {
            provider: "placeholder",
            label: " ",
            rows: ["a", "b", "c"].map((id) => ({ id: `account:${id}`, name: " ", logo: null, agentsLine: " " })),
        },
    ],
    count: 0,
    selectedId: "",
}

/** No account at all. */
const NONE: SandboxAccountsData = { groups: [], count: 0, selectedId: "" }

/** The accounts under their provider's name: the provider's mark, the account's name and a plain Badge that says it is a sandbox. */
const sectionsOf = (data: SandboxAccountsData, badge: string): ReadonlyArray<ListBoxSection> =>
    data.groups.map((group) => ({
        id: group.provider,
        label: group.label,
        items: group.rows.map((row) => ({
            id: row.id,
            label: row.name,
            description: row.agentsLine,
            leading: <ProviderLogo glyph="servers" {...(row.logo === null ? {} : { src: row.logo })} />,
            trailing: <Badge tone="neutral">{badge}</Badge>,
        })),
    }))

/**
 * The sandbox accounts as one card in the left rail, grouped by provider, the open one filled. A read in flight keeps the geometry of
 * rows, a failed read says so with its retry, and no account at all says how to make one.
 */
export const SandboxAccountsCard = (props: SandboxAccountsCardProps) => {
    const state = sandboxCardStateOf(props.slot, PLACEHOLDER, NONE, {
        message: props.copy.failTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.onRetry,
    })
    return (
        <SurfaceCard
            label={props.copy.accounts.title}
            headingLevel={2}
            isLoading={state.isLoading}
            {...(state.error === undefined ? {} : { error: state.error })}
            {...(state.isLoading || state.data.count === 0 ? {} : { count: state.data.count })}
        >
            <ListBox
                label={props.copy.accounts.listLabel}
                sections={sectionsOf(state.data, props.copy.accounts.badge)}
                selectionMode="single"
                selectionIndicator="none"
                selectedIds={state.data.selectedId === "" ? [] : [state.data.selectedId]}
                onSelectionChange={(ids) => {
                    const id = ids[0]
                    if (id !== undefined) props.onSelect(id)
                }}
                isLoading={state.isLoading}
                emptyContent={
                    <EmptyNotice
                        message={props.copy.accounts.emptyTitle}
                        iconSource={nivoIconSource("servers", "leading")}
                        description={props.copy.accounts.emptyBody}
                    />
                }
            />
        </SurfaceCard>
    )
}
