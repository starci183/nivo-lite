import type { ReactNode } from "react"
import { Cluster, DescriptionList, Drawer, EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { DossierRowsCard } from "@/components/composites/DossierRowsCard"
import type { DossierRowView } from "@/components/composites/DossierRowsCard"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ChecklistImportEntry } from "./ChecklistImportEntry"
import type { ChecklistImportEntryEvents, ChecklistImportEntryView } from "./ChecklistImportEntry"
import { DOSSIERS_CLASS_NAME } from "./classNames"

export type { DossierRowView } from "@/components/composites/DossierRowsCard"

/** One category of the documents, already worded. */
export interface CategoryRowView {
    readonly id: string
    /** The heading of its card. */
    readonly title: string
    readonly dossiers: ReadonlyArray<DossierRowView>
}

/** One figure of the strip: how many dossiers stand at a status, or how many questions wait for the owner. */
export interface FigureView {
    readonly id: string
    readonly label: string
    readonly value: string
}

/** The figures and the categories: what the slot of the block carries. */
export interface DossiersContent {
    readonly figures: ReadonlyArray<FigureView>
    readonly categories: ReadonlyArray<CategoryRowView>
}

/** Copy and values the dossiers block supplies. */
export interface BrainDossiersBaseProps {
    /** The findings of the open dossier and its draft drawer. */
    readonly shape: { readonly detail: ReactNode; readonly draftDrawer: ReactNode }
    readonly props: {
        readonly figuresLabel: string
        readonly listFooter: string
        readonly emptyCategory: string
        readonly emptyAll: string
        /** Loads the dossiers of a checklist workbook: the entry above the cards and its dialog; null for a member who may only read. */
        readonly checklistImport: ChecklistImportEntryView | null
        /** A dossier is open: its findings show in a drawer. */
        readonly hasDetail: boolean
        readonly detailLabel: string
        readonly detailCloseLabel: string
        readonly slot: DataSlot<DossiersContent>
        readonly placeholder: DossiersContent
        readonly slotLabels: SlotLabels
    }
    readonly on: ChecklistImportEntryEvents & { readonly retry: () => void; readonly closeDetail: () => void }
}

/**
 * Draws the dossiers tab: one card of figures (how many dossiers are complete, partly held, missing, and how many questions wait
 * for the owner), then one card of dossiers per category. The findings of an open dossier slide in as a drawer.
 */
export const BrainDossiersBase = (props: BrainDossiersBaseProps) => {
    const view = props.props
    return (
        <div className={DOSSIERS_CLASS_NAME}>
            {view.checklistImport === null ? null : (
                <Cluster gap="inline" justify="end">
                    <ChecklistImportEntry view={view.checklistImport} on={props.on} />
                </Cluster>
            )}
            <SlotView slot={view.slot} placeholder={view.placeholder} labels={view.slotLabels} onRetry={props.on.retry}>
                {(content, isSkeleton) => (
                    <>
                        <SurfaceCard ariaLabel={view.figuresLabel}>
                            <DescriptionList
                                layout="stat-strip"
                                isLoading={isSkeleton}
                                items={content.figures.map((figure) => ({
                                    id: figure.id,
                                    term: figure.label,
                                    description: figure.value,
                                }))}
                            />
                        </SurfaceCard>
                        {content.categories.length === 0 ? (
                            <EmptyNotice message={view.emptyAll} />
                        ) : (
                            content.categories.map((category, index) => (
                                <DossierRowsCard
                                    key={category.id}
                                    label={category.title}
                                    emptyLabel={view.emptyCategory}
                                    rows={category.dossiers}
                                    footer={index === content.categories.length - 1 ? view.listFooter : undefined}
                                    isSkeleton={isSkeleton}
                                />
                            ))
                        )}
                    </>
                )}
            </SlotView>
            {view.hasDetail ? (
                <Drawer
                    isOpen
                    onOpenChange={(isOpen) => {
                        if (!isOpen) props.on.closeDetail()
                    }}
                    title={view.detailLabel}
                    closeLabel={view.detailCloseLabel}
                    placement="right"
                >
                    {props.shape.detail}
                </Drawer>
            ) : null}
            {props.shape.draftDrawer}
        </div>
    )
}
