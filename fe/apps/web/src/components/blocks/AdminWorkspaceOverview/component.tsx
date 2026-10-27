import { Badge, Button, DescriptionList, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ADMIN_ROUTES } from "@/modules/routes"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FACTS_CLASS_NAME } from "./classNames"

/** One labelled fact of the overview; a tone draws its value as a badge. */
export interface AdminWorkspaceFact {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly tone?: BadgeTone
}

/** What the workspace read answers, worded and ready to draw. */
export interface AdminWorkspaceOverviewData {
    readonly eyebrow: string
    readonly title: string
    readonly description: string
    readonly billing: ReadonlyArray<AdminWorkspaceFact>
    readonly activity: ReadonlyArray<AdminWorkspaceFact>
}

/** The workspace read and the words around it. */
export interface AdminWorkspaceOverviewBaseProps {
    readonly props: {
        readonly allWorkspacesLabel: string
        readonly overviewTitle: string
        readonly slot: DataSlot<AdminWorkspaceOverviewData>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

const PLACEHOLDER_FACTS: ReadonlyArray<AdminWorkspaceFact> = [
    { id: "placeholder-1", term: "…", value: "…" },
    { id: "placeholder-2", term: "…", value: "…" },
    { id: "placeholder-3", term: "…", value: "…" },
]

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const OVERVIEW_PLACEHOLDER: AdminWorkspaceOverviewData = {
    eyebrow: "…",
    title: "…",
    description: "…",
    billing: PLACEHOLDER_FACTS,
    activity: PLACEHOLDER_FACTS,
}

const termsOf = (facts: ReadonlyArray<AdminWorkspaceFact>, isSkeleton: boolean) =>
    facts.map((fact) => ({
        id: fact.id,
        term: fact.term,
        description:
            fact.tone === undefined ? (
                <Text weight="medium" isSkeleton={isSkeleton}>
                    {fact.value}
                </Text>
            ) : (
                <Badge tone={fact.tone} isSkeleton={isSkeleton}>
                    {fact.value}
                </Badge>
            ),
    }))

/** Draws the read-only overview of one workspace: its heading and the billing and activity facts. */
export const AdminWorkspaceOverviewBase = (props: AdminWorkspaceOverviewBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={OVERVIEW_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => (
            <>
                <SectionHeader
                    level={1}
                    eyebrow={view.eyebrow}
                    title={view.title}
                    description={view.description}
                    isSkeleton={isSkeleton}
                    action={
                        <Button intent="neutral" href={ADMIN_ROUTES.workspaces}>
                            {props.props.allWorkspacesLabel}
                        </Button>
                    }
                />
                <SurfaceCard label={props.props.overviewTitle} headingLevel={2}>
                    <div className={FACTS_CLASS_NAME}>
                        <DescriptionList layout="columns" isDivided items={termsOf(view.billing, isSkeleton)} />
                        <DescriptionList layout="columns" isDivided items={termsOf(view.activity, isSkeleton)} />
                    </div>
                </SurfaceCard>
            </>
        )}
    </SlotView>
)
