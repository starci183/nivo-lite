import type { ReactNode } from "react"
import {
    Badge,
    Button,
    EmptyNotice,
    ListBox,
    Meter,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    SectionHeader,
} from "@starci/grammar/common"
import type { BadgeTone, PageHeaderContent } from "@starci/grammar/common"
import { DossierRowsCard } from "@/components/composites/DossierRowsCard"
import type { DossierRowView } from "@/components/composites/DossierRowsCard"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { CATEGORY_CLASS_NAME, COUNTS_CLASS_NAME } from "./classNames"

export type { DossierRowView } from "@/components/composites/DossierRowsCard"

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
    /** The findings of the open dossier and its draft drawer, drawn in the detail pane. */
    readonly shape: { readonly detail: ReactNode; readonly draftDrawer: ReactNode }
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
        /** The command that reviews the whole set; null for a member who may only read. */
        readonly reviewAll: {
            readonly label: string
            readonly isRunning: boolean
            readonly runningLabel: string
        } | null
        /** A dossier is open: its detail pane takes the third column from the wide breakpoint and is a drawer below it. */
        readonly hasDetail: boolean
        readonly detailLabel: string
        readonly detailCloseLabel: string
        readonly slot: DataSlot<DossiersContent>
        readonly placeholder: DossiersContent
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly select: (id: string) => void
        readonly retry: () => void
        readonly categoriesOpenChange: (isOpen: boolean) => void
        readonly reviewAll: () => void
        readonly closeDetail: () => void
    }
}

/** What a band draws once the slot has its content. */
interface ContentProps extends Pick<BrainDossiersBaseProps, "props" | "on"> {
    readonly content: DossiersContent
    readonly isSkeleton: boolean
}

/** The category that is open: the one picked, else the first. */
const selectedOf = (content: DossiersContent, selectedId: string | undefined): CategoryRowView | undefined =>
    content.categories.find((category) => category.id === selectedId) ?? content.categories[0]

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

/** The commands of the heading: review the whole set (owners and managers) and add a document. */
const Commands = (props: Pick<BrainDossiersBaseProps, "props" | "on">) => {
    const view = props.props
    return (
        <>
            {view.reviewAll === null ? null : (
                <Button intent="neutral" isDisabled={view.reviewAll.isRunning} onPress={props.on.reviewAll}>
                    {view.reviewAll.isRunning ? view.reviewAll.runningLabel : view.reviewAll.label}
                </Button>
            )}
            {view.addHref === null ? null : (
                <Button intent="commit" href={view.addHref}>
                    {view.addLabel}
                </Button>
            )}
        </>
    )
}

/** The status of every dossier and the dossiers of the open category, under the heading and its commands. */
const Status = (props: ContentProps) => {
    const view = props.props
    const selected = selectedOf(props.content, view.selectedId)
    return (
        <>
            <SectionHeader
                level={2}
                title={view.title}
                isSkeleton={props.isSkeleton}
                action={props.isSkeleton ? undefined : <Commands {...props} />}
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
                    <DossierRowsCard
                        label={view.listLabel}
                        emptyLabel={view.emptyCategory}
                        rows={selected.dossiers}
                        isSkeleton={props.isSkeleton}
                    />
                </div>
            )}
        </>
    )
}

/** What one band draws through the slot: its content once ready, and whether its status offers the retry. */
interface InSlotProps extends Pick<BrainDossiersBaseProps, "props" | "on"> {
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

/** The pane of the open dossier: the third column from the wide breakpoint, a drawer below it that closes the dossier. */
const DetailPane = (props: BrainDossiersBaseProps) => (
    <Pane
        area="detail"
        surface
        scroll
        label={props.props.detailLabel}
        collapse="drawer"
        collapseLabel={props.props.detailLabel}
        openLabel={props.props.detailLabel}
        closeLabel={props.props.detailCloseLabel}
        isOpen
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.closeDetail()
        }}
    >
        <PaneSection>{props.shape.detail}</PaneSection>
    </Pane>
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
        <>
            <Page chrome="panes" header={view.header} measure="product">
                <PaneGrid
                    label={view.gridLabel}
                    role="tabpanel"
                    id={view.panelId}
                    areas={
                        view.hasDetail
                            ? { base: ["main"], medium: ["list main"], wide: ["list main detail"] }
                            : { base: ["main"], medium: ["list main"] }
                    }
                    columns={
                        view.hasDetail
                            ? { base: ["fill"], medium: ["standard", "fill"], wide: ["standard", "fill", "wide"] }
                            : { base: ["fill"], medium: ["standard", "fill"] }
                    }
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
                                {(content, isSkeleton) => (
                                    <Status {...props} content={content} isSkeleton={isSkeleton} />
                                )}
                            </InSlot>
                        </PaneSection>
                    </Pane>
                    {view.hasDetail ? <DetailPane {...props} /> : null}
                </PaneGrid>
            </Page>
            {props.shape.draftDrawer}
        </>
    )
}
