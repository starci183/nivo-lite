import { SlotView } from "@nivo-lite/agent-sdk/client"
import {
    AlertDialog,
    EmptyNotice,
    Link,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Stack,
    Sublabel,
    SurfaceCard,
    Text,
    type ListRowData,
} from "@starci/grammar/common"
import type {
    AccountRowView,
    AccountsCardCopy,
    AgentConnectionsBaseProps,
    NivoToolsView,
    RightsPageView,
    ToolRowView,
} from "./types"

export type { AgentConnectionsBaseProps } from "./types"

type On = AgentConnectionsBaseProps["on"]

/** The input of the tools section. */
interface ToolsInput {
    readonly view: NivoToolsView
}

/** One tool as a list row: its name over the 12 muted line and the "acts"/"reads" chip; muted when not usable. */
const toolItemOf = (row: ToolRowView): ListRowData => ({
    id: row.id,
    title: row.title,
    // A node line is drawn at 12 muted under the name (a string line would be 14).
    ...(row.subtitle === ""
        ? {}
        : {
              description: (
                  <Text as="span" size="xs" tone="muted">
                      {row.subtitle}
                  </Text>
              ),
          }),
    badges: [{ label: row.chip }],
    ...(row.isReady ? {} : { state: "unavailable" as const }),
})

/** The NIVO tools the agent may call: the label with its count and the head link to the rules, then one card per origin under its small label. */
const ToolsSection = ({ view }: ToolsInput) => (
    <Section
        kind="region"
        title={view.title}
        count={view.count}
        headingLevel={2}
        action={
            <Link variant="head" href={view.linkHref}>
                {view.linkLabel}
            </Link>
        }
    >
        <Stack gap="inline">
            {view.groups.flatMap((group) => [
                <Sublabel key={`label-${group.id}`}>{group.label}</Sublabel>,
                <SurfaceCard
                    key={group.id}
                    kind="list"
                    ariaLabel={group.label}
                    empty={<EmptyNotice message={view.emptyLabel} />}
                    items={group.rows.map((row) => toolItemOf(row))}
                />,
            ])}
        </Stack>
    </Section>
)

/** The input of the node-model account card. */
interface AccountsInput {
    readonly view: RightsPageView
    readonly copy: AccountsCardCopy
    readonly isLoading: boolean
    readonly on: On
}

/** One account as a row: its mark, its name over "<provider> · <steps line | not attached>", and at the end the neutral small "Detach" or "Attach". */
const accountItemOf = (row: AccountRowView, copy: AccountsCardCopy, on: On): ListRowData => ({
    id: row.id,
    title: row.name,
    description: row.line,
    leading: {
        avatar: { name: row.name, ...(row.logo === undefined ? {} : { src: row.logo }), shape: "rounded" },
        size: "md",
    },
    actionPlacement: "end",
    action: row.isAttached
        ? { label: copy.detach, intent: "neutral", press: () => on.askDetach(row.id) }
        : { label: copy.attach, intent: "neutral", press: () => on.attach(row.id) },
})

/**
 * The accounts card of the node model: the label with the count of attached accounts, one row per connected account of the workspace
 * the agent can use (attached ones say how many steps use them), what detaching does in the note under the card.
 */
const AccountsCard = ({ view, copy, isLoading, on }: AccountsInput) => (
    <SurfaceCard
        kind="list"
        label={copy.title}
        headingLevel={2}
        count={view.attachedCount}
        note={copy.note}
        isLoading={isLoading}
        empty={<EmptyNotice message={copy.empty} />}
        items={view.accounts.map((row) => accountItemOf(row, copy, on))}
    />
)

/** Draws the rights tab of an agent as one well: the account card (attach, detach), the read-only roll-up of what the steps call and the NIVO tools. The detach confirm opens over it. */
export const AgentConnectionsBase = (props: AgentConnectionsBaseProps) => {
    const { props: view, on } = props
    return (
        <>
            <PaneGrid label={view.paneLabel} areas={{ base: ["well"] }} columns={{ base: ["fill"] }}>
                <Pane area="well" scroll label={view.paneLabel}>
                    <PaneSection gap="section">
                        <SlotView
                            {...view.read}
                            onRetry={on.retry}
                            render={(page, isLoading) => (
                                <AccountsCard
                                    view={page}
                                    copy={view.accountsCard}
                                    isLoading={isLoading || view.isBoardLoading}
                                    on={on}
                                />
                            )}
                        />
                        {view.rollup}
                        {view.tools === undefined ? null : <ToolsSection view={view.tools} />}
                    </PaneSection>
                </Pane>
            </PaneGrid>
            <AlertDialog
                isOpen={view.detach.isOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) on.cancelDetach()
                }}
                title={view.detach.title}
                description={view.detach.description}
                tone="negative"
                confirmLabel={view.detach.confirm}
                cancelLabel={view.detach.cancel}
                isConfirmPending={false}
                onConfirm={on.confirmDetach}
            />
        </>
    )
}
