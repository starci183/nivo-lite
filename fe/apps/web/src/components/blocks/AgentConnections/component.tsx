import {
    AlertDialog,
    Button,
    Cluster,
    Drawer,
    Link,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Stack,
    Sublabel,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { ProviderRightsCard } from "@/components/composites/ProviderRightsCard"
import type { ProviderRightsCardProps } from "@/components/composites/ProviderRightsCard"

/** One group of provider cards under its small label (Nhắn tin, Thanh toán, Sổ sách). */
export interface ProviderGroupView {
    readonly id: string
    readonly label: string
    readonly cards: ReadonlyArray<{ readonly id: string; readonly card: ProviderRightsCardProps }>
}

/** One provider the agent could still be given. */
export interface AttachOptionView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
}

/** The "Công cụ NIVO" choice card. */
export interface NivoToolsView {
    readonly title: string
    readonly linkLabel: string
    readonly linkHref: string
    readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly subtitle: string; readonly isOn: boolean }>
    readonly isDisabled: boolean
}

/** The tab "Quyền" of one agent: the providers it holds with what it may do through each, then the NIVO tools. */
export interface AgentConnectionsBaseProps {
    readonly props: {
        readonly paneLabel: string
        readonly title: string
        readonly attachLabel: string
        readonly groups: ReadonlyArray<ProviderGroupView>
        readonly emptyLabel: string
        readonly tools: NivoToolsView
        readonly drawer: {
            readonly isOpen: boolean
            readonly title: string
            readonly closeLabel: string
            readonly options: ReadonlyArray<AttachOptionView>
            readonly optionsLabel: string
            readonly pickedId: string | null
            readonly emptyLabel: string
            readonly cancelLabel: string
            readonly submitLabel: string
        }
        readonly detach: {
            readonly isOpen: boolean
            readonly title: string
            readonly description: string
            readonly confirm: string
            readonly cancel: string
        }
    }
    readonly on: {
        readonly openDrawer: () => void
        readonly closeDrawer: () => void
        readonly pickAttach: (id: string) => void
        readonly submitAttach: () => void
        readonly cancelDetach: () => void
        readonly confirmDetach: () => void
        readonly toggleTool: (tool: string, isOn: boolean) => void
    }
}

type Props = AgentConnectionsBaseProps["props"]
type On = AgentConnectionsBaseProps["on"]

/** The cards of the providers the agent holds, grouped under small labels. */
const ProviderGroups = ({ view }: { readonly view: Props }) => (
    <Stack gap="inline">
        {view.groups.length === 0 ? (
            <Text tone="muted">{view.emptyLabel}</Text>
        ) : (
            view.groups.map((group) => (
                <Stack key={group.id} gap="inline">
                    <Sublabel>{group.label}</Sublabel>
                    <Stack gap="inline">
                        {group.cards.map((entry) => (
                            <ProviderRightsCard key={entry.id} {...entry.card} />
                        ))}
                    </Stack>
                </Stack>
            ))
        )}
    </Stack>
)

/** The NIVO tools the agent may call: a choice card with a "n / m" chip and a head link to the rules in the Second Brain. */
const NivoTools = ({ view, on }: { readonly view: NivoToolsView; readonly on: On }) => (
    <SurfaceCard
        kind="select"
        selectionMode="multiple"
        label={view.title}
        headingLevel={2}
        fact={`${view.rows.filter((row) => row.isOn).length} / ${view.rows.length}`}
        labelEnd={
            <Link variant="head" href={view.linkHref}>
                {view.linkLabel}
            </Link>
        }
        items={view.rows.map((row) => ({
            id: row.id,
            title: row.title,
            subtitle: row.subtitle,
            isDisabled: view.isDisabled,
        }))}
        value={view.rows.filter((row) => row.isOn).map((row) => row.id)}
        onChange={(keys) => {
            const next = new Set(keys)
            view.rows.forEach((row) => {
                if (next.has(row.id) !== row.isOn) on.toggleTool(row.id, next.has(row.id))
            })
        }}
    />
)

/** The drawer that lists the connected providers the agent does not hold yet. */
const AttachDrawer = ({ view, on }: { readonly view: Props["drawer"]; readonly on: On }) => (
    <Drawer
        isOpen={view.isOpen}
        onOpenChange={(isOpen) => (isOpen ? undefined : on.closeDrawer())}
        title={view.title}
        closeLabel={view.closeLabel}
        footer={
            <Cluster gap="inline" justify="end">
                <Button intent="neutral" onPress={on.closeDrawer}>
                    {view.cancelLabel}
                </Button>
                <Button intent="commit" isDisabled={view.pickedId === null} onPress={on.submitAttach}>
                    {view.submitLabel}
                </Button>
            </Cluster>
        }
    >
        {view.options.length === 0 ? (
            <Text tone="muted">{view.emptyLabel}</Text>
        ) : (
            <SurfaceCard
                kind="select"
                selectionMode="single"
                ariaLabel={view.optionsLabel}
                items={view.options.map((option) => ({ id: option.id, title: option.title, subtitle: option.subtitle }))}
                value={view.pickedId}
                onChange={on.pickAttach}
            />
        )}
    </Drawer>
)

/** Draws the Quyền tab of an agent as one well: the providers it holds (grouped), then the NIVO tools; the attach drawer and the detach confirm open over it. */
export const AgentConnectionsBase = (props: AgentConnectionsBaseProps) => {
    const { props: view, on } = props
    return (
        <>
            <PaneGrid label={view.paneLabel} areas={{ base: ["well"] }} columns={{ base: ["fill"] }}>
                <Pane area="well" scroll label={view.paneLabel}>
                    <PaneSection gap="section">
                        <Section
                            kind="region"
                            title={view.title}
                            count={view.groups.reduce((sum, group) => sum + group.cards.length, 0)}
                            headingLevel={2}
                        >
                            <Stack gap="row">
                                <Cluster gap="inline" justify="end">
                                    <Button size="sm" intent="neutral" onPress={on.openDrawer}>
                                        {view.attachLabel}
                                    </Button>
                                </Cluster>
                                <ProviderGroups view={view} />
                            </Stack>
                        </Section>
                        <NivoTools view={view.tools} on={on} />
                    </PaneSection>
                </Pane>
            </PaneGrid>
            <AttachDrawer view={view.drawer} on={on} />
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
