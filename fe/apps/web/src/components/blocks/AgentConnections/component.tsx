import {
    AlertDialog,
    Button,
    Drawer,
    EmptyNotice,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Stack,
    Sublabel,
    SurfaceCard,
} from "@starci/grammar/common"
import { ProviderRightsCard } from "@/components/composites/ProviderRightsCard"
import type { AgentConnectionsBaseProps, AttachDrawerView } from "./types"

export type { AgentConnectionsBaseProps } from "./types"

type Props = AgentConnectionsBaseProps["props"]
type On = AgentConnectionsBaseProps["on"]

/** The input of a part that needs the view and the commands. */
interface PartInput {
    readonly view: Props
    readonly on: On
}

/** The input of the accounts list: the view only. */
interface ViewInput {
    readonly view: Props
}

/** The input of the attach drawer parts. */
interface DrawerInput {
    readonly view: AttachDrawerView
    readonly on: On
}

/** The cards of the accounts the agent holds in one flat run: a small label above the cards of its group, 8px between all of them. */
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

/** The body of the attach drawer: one row per connected account not attached (mark, name, consequence line, "Attach"), or the notice that none is left. */
const AttachOptions = ({ view, on }: DrawerInput) => (
    <SurfaceCard
        kind="list"
        ariaLabel={view.optionsLabel}
        empty={<EmptyNotice message={view.emptyLabel} />}
        items={view.options.map((option) => ({
            id: option.id,
            title: option.title,
            description: option.subtitle,
            leading: {
                avatar: { name: option.name, ...(option.logo === undefined ? {} : { src: option.logo }), shape: "rounded" },
                size: "md",
            },
            actionPlacement: "end",
            action: { label: view.attachLabel, intent: "neutral", press: () => on.attach(option.id) },
        }))}
    />
)

/** The drawer that lists the connected accounts the agent does not hold yet. */
const AttachDrawer = ({ view, on }: DrawerInput) => (
    <Drawer
        isOpen={view.isOpen}
        onOpenChange={(isOpen) => (isOpen ? undefined : on.closeDrawer())}
        title={view.title}
        closeLabel={view.closeLabel}
    >
        <AttachOptions view={view} on={on} />
    </Drawer>
)

/** The section of the attached accounts: its label with the count chip and, at the end of the head, the neutral small "attach more" button; then the groups. */
const ProvidersSection = ({ view, on }: PartInput) => (
    <Section
        kind="region"
        title={view.title}
        count={view.groups.reduce((sum, group) => sum + group.cards.length, 0)}
        headingLevel={2}
        action={
            <Button size="sm" intent="neutral" onPress={on.openDrawer}>
                {view.attachLabel}
            </Button>
        }
    >
        <ProviderGroups view={view} />
    </Section>
)

/** Draws the rights tab of an agent as one well: the accounts it holds (grouped by kind); the attach drawer and the detach confirm open over it. */
export const AgentConnectionsBase = (props: AgentConnectionsBaseProps) => {
    const { props: view, on } = props
    return (
        <>
            <PaneGrid label={view.paneLabel} areas={{ base: ["well"] }} columns={{ base: ["fill"] }}>
                <Pane area="well" scroll label={view.paneLabel}>
                    <PaneSection gap="section">
                        <ProvidersSection view={view} on={on} />
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
