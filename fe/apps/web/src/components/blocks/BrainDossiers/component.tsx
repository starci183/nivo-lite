import type { ReactNode } from "react"
import {
    Badge,
    Button,
    EmptyNotice,
    ListBox,
    ListRow,
    Meter,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    SectionHeader,
    SurfaceListCard,
} from "@starci/grammar/common"
import type { BadgeTone, PageHeaderContent } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { CATEGORY_CLASS_NAME, COUNTS_CLASS_NAME } from "./classNames"

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
        /** The Second Brain header with its tabs: the grid attaches flush under the tab line. */
        readonly header: PageHeaderContent
        /** The id of the dossiers tab panel, which the grid is. */
        readonly panelId: string
        readonly gridLabel: string
        readonly categoriesLabel: string
        /** The close control of the categories drawer, below the medium breakpoint. */
        readonly categoriesCloseLabel: string
        /** Whether the categories drawer is open (below the medium breakpoint the categories are a drawer). */
        readonly isCategoriesOpen: boolean
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
        readonly categoriesOpenChange: (isOpen: boolean) => void
    }
}

/** What a band draws once the slot has its content. */
interface ContentProps extends BrainDossiersBaseProps {
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

/** The category that is open: the one picked, else the first. */
const selectedOf = (content: DossiersContent, selectedId: string | undefined): CategoryRowView | undefined =>
    content.categories.find((category) => category.id === selectedId) ?? content.categories[0]

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

/** The categories of the documents: the rows of the list band, each opening its dossiers. */
const Categories = (props: ContentProps) => {
    const view = props.props
    const selected = selectedOf(props.content, view.selectedId)
    return (
        <ListBox
            label={view.categoriesLabel}
            inset="panel"
            selectionMode="single"
            selectionIndicator="none"
            selectedIds={selected === undefined ? [] : [selected.id]}
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
    )
}

/** The status of every dossier and the dossiers of the open category, under the heading and its add command. */
const Status = (props: ContentProps) => {
    const view = props.props
    const selected = selectedOf(props.content, view.selectedId)
    return (
        <>
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
        </>
    )
}

/** What one band draws through the slot: its content once ready, and whether its status offers the retry. */
interface InSlotProps extends BrainDossiersBaseProps {
    readonly children: (content: DossiersContent, isSkeleton: boolean) => ReactNode
    readonly withRetry: boolean
}

/** The slot of the block drawn in one band: its content, or its status in place. */
const InSlot = (props: InSlotProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        {...(props.withRetry ? { onRetry: props.on.retry } : {})}
    >
        {props.children}
    </SlotView>
)

/**
 * Draws the dossiers tab of the Second Brain as a panes page: the header with its tabs, then a PaneGrid attached flush
 * under the tab line and reaching the viewport bottom. The categories pane, on the surface, holds the allowance meter over
 * the categories and becomes a drawer below the medium breakpoint; the main pane holds the status of all dossiers and the
 * dossiers of the open category. Each pane draws the slot's status in its own band.
 */
export const BrainDossiersBase = (props: BrainDossiersBaseProps) => {
    const view = props.props
    return (
        <Page chrome="panes" header={view.header} measure="product">
            <PaneGrid
                label={view.gridLabel}
                role="tabpanel"
                id={view.panelId}
                areas={{ base: ["main"], medium: ["list main"] }}
                columns={{ base: ["fill"], medium: ["standard", "fill"] }}
                rows={{ base: ["fill"], medium: ["fill"] }}
            >
                <Pane
                    area="list"
                    surface
                    collapse="drawer"
                    collapseLabel={view.categoriesLabel}
                    openLabel={view.categoriesLabel}
                    closeLabel={view.categoriesCloseLabel}
                    isOpen={view.isCategoriesOpen}
                    onOpenChange={props.on.categoriesOpenChange}
                >
                    {view.usage === undefined ? null : (
                        <PaneSection>
                            <Meter
                                label={view.usage.label}
                                value={view.usage.value}
                                minValue={0}
                                maxValue={view.usage.max}
                                valueLabel={view.usage.valueLabel}
                                tone={view.usage.tone}
                            />
                        </PaneSection>
                    )}
                    <PaneSection scroll={{ label: view.categoriesLabel }}>
                        <InSlot {...props} withRetry={false}>
                            {(content, isSkeleton) => (
                                <Categories {...props} content={content} isSkeleton={isSkeleton} />
                            )}
                        </InSlot>
                    </PaneSection>
                </Pane>
                <Pane area="main" scroll label={view.title}>
                    <PaneSection gap="section">
                        <InSlot {...props} withRetry>
                            {(content, isSkeleton) => <Status {...props} content={content} isSkeleton={isSkeleton} />}
                        </InSlot>
                    </PaneSection>
                </Pane>
            </PaneGrid>
        </Page>
    )
}
