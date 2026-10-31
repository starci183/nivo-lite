import {
    Badge,
    Button,
    EmptyNotice,
    FillViewport,
    ListBox,
    ListRow,
    Meter,
    Pane,
    PaneGrid,
    SectionHeader,
    SurfaceListCard,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { CATEGORY_CLASS_NAME, COUNTS_CLASS_NAME, MAIN_PANE_CLASS_NAME, METER_CLASS_NAME } from "./classNames"

/** One dossier of the selected category, already worded. */
export interface DossierRowView {
    readonly id: string
    readonly name: string
    /** The one line under the name: what is missing, or what is already held; null when the checklist says neither. */
    readonly note: string | null
    readonly status: { readonly label: string; readonly tone: BadgeTone }
    /** How many documents name it, already worded. */
    readonly documents: string
}

/** One category of the documents, already worded. */
export interface CategoryRowView {
    readonly id: string
    /** The number and name in the list. */
    readonly label: string
    /** The documents and size line under it. */
    readonly meta: string
    /** The heading over its dossiers. */
    readonly title: string
    readonly dossiers: ReadonlyArray<DossierRowView>
}

/** The categories and the counts over all dossiers: what the slot of the block carries. */
export interface DossiersContent {
    readonly categories: ReadonlyArray<CategoryRowView>
    readonly counts: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: BadgeTone }>
}

/** The allowance meter as the grid draws it. */
interface MeterView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** Copy and values the dossiers block supplies. */
export interface BrainDossiersBaseProps {
    readonly props: {
        readonly gridLabel: string
        readonly categoriesLabel: string
        readonly listLabel: string
        readonly title: string
        readonly addLabel: string
        /** Where the existing upload opens; null for a member who may only read. */
        readonly addHref: string | null
        readonly emptyCategory: string
        readonly emptyAll: string
        readonly usage: MeterView | undefined
        readonly selectedId: string | undefined
        readonly slot: DataSlot<DossiersContent>
        readonly placeholder: DossiersContent
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly select: (id: string) => void
        readonly retry: () => void
    }
}

/** What the grid draws once the slot has its content. */
interface GridProps extends BrainDossiersBaseProps {
    readonly content: DossiersContent
    readonly isSkeleton: boolean
}

/** What the card of dossiers draws: the copy, the selected category and whether its rows are a placeholder. */
interface DossiersProps {
    readonly listLabel: string
    readonly emptyCategory: string
    readonly category: CategoryRowView
    readonly isSkeleton: boolean
}

/** The dossiers of the selected category as rows of one card. */
const Dossiers = (props: DossiersProps) => (
    <SurfaceListCard
        ariaLabel={props.listLabel}
        isLoading={props.isSkeleton}
        empty={<EmptyNotice message={props.emptyCategory} />}
    >
        {props.isSkeleton
            ? null
            : props.category.dossiers.map((dossier) => (
                  <ListRow
                      key={dossier.id}
                      title={dossier.name}
                      description={dossier.note}
                      badges={
                          <>
                              <Badge tone={dossier.status.tone}>{dossier.status.label}</Badge>
                              <Badge tone="muted">{dossier.documents}</Badge>
                          </>
                      }
                  />
              ))}
    </SurfaceListCard>
)

/** What the pane of the categories draws: the grid props and the category that is open. */
interface CategoryPaneProps extends GridProps {
    readonly selected: CategoryRowView | undefined
}

/** The pane of the categories on the surface ground: the allowance meter over the list. */
const CategoryPane = (props: CategoryPaneProps) => {
    const view = props.props
    return (
        <Pane area="list" surface scroll label={view.categoriesLabel}>
            {view.usage === undefined ? null : (
                <div className={METER_CLASS_NAME}>
                    <Meter
                        label={view.usage.label}
                        value={view.usage.value}
                        minValue={0}
                        maxValue={view.usage.max}
                        valueLabel={view.usage.valueLabel}
                        tone={view.usage.tone}
                    />
                </div>
            )}
            <ListBox
                label={view.categoriesLabel}
                inset="panel"
                selectionMode="single"
                selectionIndicator="none"
                selectedIds={props.selected === undefined ? [] : [props.selected.id]}
                onSelectionChange={(ids) => {
                    const next = ids[0]
                    if (next !== undefined) props.on.select(next)
                }}
                isLoading={props.isSkeleton}
                items={props.content.categories.map((category) => ({
                    id: category.id,
                    label: category.label,
                    description: category.meta,
                }))}
            />
        </Pane>
    )
}

/** The two panes: the categories on the surface, and the status with the dossiers of the selected one. */
const Grid = (props: GridProps) => {
    const view = props.props
    const categories = props.content.categories
    const selected = categories.find((category) => category.id === view.selectedId) ?? categories[0]
    return (
        <PaneGrid
            label={view.gridLabel}
            areas={{ base: ["list", "main"], medium: ["list main"] }}
            columns={{ base: ["fill"], medium: ["standard", "fill"] }}
            rows={{ base: ["auto", "fill"], medium: ["fill"] }}
        >
            <CategoryPane {...props} selected={selected} />
            <Pane area="main" scroll label={view.title}>
                <div className={MAIN_PANE_CLASS_NAME}>
                    <SectionHeader
                        level={2}
                        title={view.title}
                        isSkeleton={props.isSkeleton}
                        action={
                            view.addHref === null || props.isSkeleton ? undefined : (
                                <Button intent="commit" href={view.addHref}>
                                    {view.addLabel}
                                </Button>
                            )
                        }
                    />
                    <div className={COUNTS_CLASS_NAME}>
                        {props.content.counts.map((count) => (
                            <Badge key={count.id} tone={count.tone} isSkeleton={props.isSkeleton}>
                                {count.label}
                            </Badge>
                        ))}
                    </div>
                    {selected === undefined ? (
                        <EmptyNotice message={view.emptyAll} />
                    ) : (
                        <div className={CATEGORY_CLASS_NAME}>
                            <SectionHeader level={3} title={selected.title} isSkeleton={props.isSkeleton} />
                            <Dossiers
                                listLabel={view.listLabel}
                                emptyCategory={view.emptyCategory}
                                category={selected}
                                isSkeleton={props.isSkeleton}
                            />
                        </div>
                    )}
                </div>
            </Pane>
        </PaneGrid>
    )
}

/**
 * Draws the dossiers of the Second Brain on a PaneGrid filling the page: the categories of the documents on the surface, with the
 * allowance meter over them, and beside them the status of all dossiers and the dossiers of the selected category.
 */
export const BrainDossiersBase = (props: BrainDossiersBaseProps) => (
    <FillViewport minHeight="md" bottomInset="none">
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(content, isSkeleton) => <Grid {...props} content={content} isSkeleton={isSkeleton} />}
        </SlotView>
    </FillViewport>
)
