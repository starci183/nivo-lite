import { Alert, EmptyNotice, Page, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { PolicyDrawer } from "@/components/frames/PolicyDrawer"
import { nivoIconSource } from "@/components/leaves/Icon"
import { VALUE_CLASS_NAME } from "./classNames"
import type {
    BrainPageHeaderView,
    PoliciesView,
    PolicyDrawerView,
    PolicyFormView,
    PolicyRowView,
} from "@/modules/types"

/** Props for {@link BrainPoliciesBase}. */
export interface BrainPoliciesBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly view: PoliciesView
        readonly drawer: PolicyDrawerView["props"]
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly retry: () => void
        readonly open: (factId: string) => void
        readonly addDocuments: () => void
        readonly derive: () => void
        readonly closeDrawer: () => void
        readonly submit: () => void
        readonly patch: (change: Partial<PolicyFormView>) => void
        readonly use: (proposalId: string) => void
        readonly reject: (proposalId: string) => void
    }
}

/** What the value at the end of a row reads. */
interface RowValueProps {
    readonly row: PolicyRowView
}

/** The value at the end of a row: the value in force, and under it the value scheduled next. */
const RowValue = ({ row }: RowValueProps) => (
    <div className={VALUE_CLASS_NAME}>
        <Stack gap="identity" align="end">
            <Text as="span" tone={row.isUnset ? "muted" : "default"}>
                {row.value}
            </Text>
            {row.scheduled === null ? null : (
                <Text as="span" size="xs" tone="muted">
                    {row.scheduled}
                </Text>
            )}
        </Stack>
    </div>
)

/** One rule as a list row: the name over the 12 muted line, the value, the waiting proposals as a badge (no dot) and, for the owner, edit or set. */
const itemOf = (row: PolicyRowView, props: BrainPoliciesBaseProps): ListRowData => ({
    id: row.id,
    title: row.name,
    // A node line is drawn at 12 muted under the name (a string line would be 14).
    description: (
        <Text as="span" size="xs" tone="muted">
            {row.line}
        </Text>
    ),
    value: <RowValue row={row} />,
    ...(row.pending === null ? {} : { badges: [{ label: row.pending, tone: "warning" as const }] as const }),
    ...(props.props.view.canEdit
        ? {
              actionPlacement: "end" as const,
              action: {
                  label: row.isUnset ? props.props.view.copy.set : props.props.view.copy.edit,
                  press: () => props.on.open(row.id),
              },
          }
        : {}),
})

/**
 * What the derive pass says above the rows, never in a status colour: it runs (the pending tone's spinner, no command; the tab reads
 * again by itself), or it failed (the neutral tone, the reason and one neutral retry). The rows derived so far stay under it.
 */
const DeriveNotice = (props: BrainPoliciesBaseProps) => {
    const { notice, copy } = props.props.view
    if (notice === null) return null
    if (notice.kind === "deriving") return <Alert tone="pending" title={notice.title} description={notice.body} />
    return (
        <Alert
            tone="neutral"
            title={notice.title}
            description={notice.body}
            action={{ label: copy.retry, onAction: props.on.derive }}
        />
    )
}

/** The first pass, offered to a shop whose policies the AI has not derived yet: the page's one primary command. */
const FirstDerive = (props: BrainPoliciesBaseProps) => {
    const { notDerived, copy, isDerivePending } = props.props.view
    if (notDerived === null) return null
    return (
        <EmptyNotice
            message={notDerived.title}
            description={notDerived.body}
            actionLabel={copy.deriveAction}
            isActionPending={isDerivePending}
            onAction={props.on.derive}
            iconSource={nivoIconSource("brain", "leading")}
        />
    )
}

/**
 * The groups of the tab through the one status recipe: the cards of the read, their skeleton from the same cards while it loads, its
 * own failure with a retry of that read, and one empty notice. Where the derive pass already speaks (its notice, or the first-pass
 * offer) an empty read says nothing more.
 */
const Groups = (props: BrainPoliciesBaseProps) => {
    const { view } = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            errorDescription={view.copy.errorBody}
            emptyDescription={view.copy.emptyBody}
            emptyIconSource={nivoIconSource("brain", "leading")}
            emptyAction={{ label: view.copy.emptyAction, onAction: props.on.addDocuments }}
            empty={view.notice === null && view.notDerived === null ? "notice" : "collapse"}
            onRetry={props.on.retry}
            render={(groups, isLoading) => (
                <Stack gap="section">
                    {groups.map((group) => (
                        <SurfaceCard
                            key={group.id}
                            kind="list"
                            label={group.label}
                            ariaLabel={view.copy.listLabel}
                            isLoading={isLoading}
                            items={group.rows.map((row) => itemOf(row, props))}
                            empty={null}
                        />
                    ))}
                </Stack>
            )}
        />
    )
}

/**
 * The policies tab: the Second Brain header with its tabs, then how the derive pass goes (when it runs or failed) and one card per
 * derived group of the shop's policies (the name the AI gave and its source
 * and readers, the value at the end with the value scheduled next, the proposals waiting, the owner's edit), and the drawer that edits
 * one rule. The tab holds no value of its own: it is the founder's view and edit handle over the truth graph.
 */
export const BrainPoliciesBase = (props: BrainPoliciesBaseProps) => {
    const { header, drawer } = props.props
    return (
        <Page
            header={{
                ...header.heading,
                actions: <BrainHeaderActions add={header.actions.add} />,
                tabs: brainHeaderTabs({ tabs: header.tabs, onSelect: props.on.selectTab }),
            }}
            measure="product"
        >
            <Stack gap="section">
                <DeriveNotice {...props} />
                <FirstDerive {...props} />
                <Groups {...props} />
            </Stack>
            <PolicyDrawer
                props={drawer}
                on={{
                    close: props.on.closeDrawer,
                    submit: props.on.submit,
                    patch: props.on.patch,
                    use: props.on.use,
                    reject: props.on.reject,
                }}
            />
        </Page>
    )
}
