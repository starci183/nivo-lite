import { Button, Cluster, EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { ChecklistImportDialog } from "@/components/composites/ChecklistImportDialog"
import type { ChecklistImportDialogProps } from "@/components/composites/ChecklistImportDialog"
import { DossierRowsCard } from "@/components/composites/DossierRowsCard"
import type { DossierRowView } from "@/components/composites/DossierRowsCard"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { DOSSIERS_CLASS_NAME } from "./classNames"

export type { DossierRowView } from "@/components/composites/DossierRowsCard"

/** The entry that loads a checklist workbook and its dialog while open. */
interface ChecklistImportEntryView {
    readonly label: string
    readonly dialog: ChecklistImportDialogProps["props"] | null
}

interface ChecklistImportEntryEvents {
    readonly openImport: () => void
    readonly pickImport: (files: Array<File>) => void
    readonly confirmImport: () => void
    readonly closeImport: () => void
}

interface ChecklistImportEntryProps {
    readonly view: ChecklistImportEntryView
    readonly on: ChecklistImportEntryEvents
}

/** The unchanged checklist entry and the focused import task it opens. */
const ChecklistImportEntry = (props: ChecklistImportEntryProps) => (
    <>
        <Button intent="neutral" onPress={props.on.openImport}>
            {props.view.label}
        </Button>
        {props.view.dialog === null ? null : (
            <ChecklistImportDialog
                props={props.view.dialog}
                on={{ pick: props.on.pickImport, confirm: props.on.confirmImport, close: props.on.closeImport }}
            />
        )}
    </>
)

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
    readonly props: {
        readonly figuresLabel: string
        readonly listFooter: string
        readonly emptyCategory: string
        readonly emptyAll: string
        /** Loads the dossiers of a checklist workbook: the entry above the cards and its dialog; null for a member who may only read. */
        readonly checklistImport: ChecklistImportEntryView | null
        readonly slot: DataSlot<DossiersContent>
        readonly placeholder: DossiersContent
        readonly slotLabels: SlotLabels
    }
    readonly on: ChecklistImportEntryEvents & { readonly retry: () => void }
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
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.slotLabels}
                onRetry={props.on.retry}
                render={(content, isLoading) => (
                    <>
                        <SurfaceCard
                            kind="figures"
                            ariaLabel={view.figuresLabel}
                            isLoading={isLoading}
                            items={content.figures.map((figure) => ({
                                id: figure.id,
                                term: figure.label,
                                value: figure.value,
                            }))}
                        />
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
                                    isLoading={isLoading}
                                />
                            ))
                        )}
                    </>
                )}
            />
        </div>
    )
}
