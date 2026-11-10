import {
    AlertDialog,
    Button,
    Cluster,
    Drawer,
    EmptyNotice,
    Link,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Stack,
    Sublabel,
    SurfaceCard,
} from "@starci/grammar/common"
import { ProviderRightsCard } from "@/components/composites/ProviderRightsCard"
import type { AgentConnectionsBaseProps, AttachDrawerView, NivoToolsView } from "./types"

export type { AgentConnectionsBaseProps } from "./types"

type Props = AgentConnectionsBaseProps["props"]
type On = AgentConnectionsBaseProps["on"]

/** The input of a part that needs the view and the commands. */
interface PartInput {
    readonly view: Props
    readonly on: On
}

/** The input of the providers list: the view only. */
interface ViewInput {
    readonly view: Props
}

/** The input of the tools card. */
interface ToolsInput {
    readonly view: NivoToolsView
    readonly on: On
}

/** The input of the attach drawer parts. */
interface DrawerInput {
    readonly view: AttachDrawerView
    readonly on: On
}

/** The cards of the providers the agent holds in one flat run: a small label above the cards of its group, 8px between all of them. */
const ProviderGroups = ({ view }: ViewInput) => {
    if (view.groups.length === 0) return <EmptyNotice message={view.emptyLabel} />
    return (
        <Stack gap="inline">
            {view.groups.flatMap((group) => [
                <Sublabel key={`label-${group.id}`}>{group.label}</Sublabel>,
                ...group.cards.map((entry) => <ProviderRightsCard key={entry.id} {...entry.card} />),
            ])}
        </Stack>
    )
}

/** The NIVO tools the agent may call: a choice card with an "n / m" chip and a head link to the rules in the Second Brain. */
const NivoTools = ({ view, on }: ToolsInput) => (
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

/** The body of the attach drawer: the connected providers to pick from, or the notice that none is left. */
const AttachOptions = ({ view, on }: DrawerInput) => {
    if (view.options.length === 0) return <EmptyNotice message={view.emptyLabel} />
    return (
        <SurfaceCard
            kind="select"
            selectionMode="single"
            ariaLabel={view.optionsLabel}
            items={view.options.map((option) => ({ id: option.id, title: option.title, subtitle: option.subtitle }))}
            value={view.pickedId}
            onChange={on.pickAttach}
        />
    )
}

/** The drawer that lists the connected providers the agent does not hold yet. */
const AttachDrawer = ({ view, on }: DrawerInput) => (
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
        <AttachOptions view={view} on={on} />
    </Drawer>
)

/** The section of the held providers: its label with the count chip, the neutral small pill that opens the drawer, then the groups. */
const ProvidersSection = ({ view, on }: PartInput) => (
    <Section
        kind="region"
        title={view.title}
        count={view.groups.reduce((sum, group) => sum + group.cards.length, 0)}
        headingLevel={2}
    >
        <Stack gap="inline">
            <Cluster gap="identity" justify="end">
                <Button size="sm" intent="neutral" onPress={on.openDrawer}>
                    {view.attachLabel}
                </Button>
            </Cluster>
            <ProviderGroups view={view} />
        </Stack>
    </Section>
)

/** Draws the rights tab of an agent as one well: the providers it holds (grouped), then the NIVO tools; the attach drawer and the detach confirm open over it. */
export const AgentConnectionsBase = (props: AgentConnectionsBaseProps) => {
    const { props: view, on } = props
    return (
        <>
            <PaneGrid label={view.paneLabel} areas={{ base: ["well"] }} columns={{ base: ["fill"] }}>
                <Pane area="well" scroll label={view.paneLabel}>
                    <PaneSection gap="section">
                        <ProvidersSection view={view} on={on} />
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
