import { Page, Pane, PaneGrid } from "@starci/grammar/common"
import { ChecklistImportDialog, type ChecklistImportDialogProps } from "@/components/composites/ChecklistImportDialog"
import { brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import type { DossierFindingsPane, FindingAction } from "@/components/composites/DossierFindingBoard"
import type { FindingDialogValues, FindingDialogView } from "@/components/composites/DossierFindingDialogs"
import { DossierHeaderActions } from "@/components/composites/DossierHeaderActions"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { DossierAside } from "@/components/frames/DossierAside"
import { DossierHeadBand, type DossierMainCopy } from "@/components/frames/DossierHeadBand"
import {
    DossierList,
    type DossierDeskView,
    type DossierListCopy,
    type DossierMode,
} from "@/components/frames/DossierList"
import { DossierMainBody } from "@/components/frames/DossierMainBody"
import { DossierMapDetail } from "@/components/frames/DossierMapDetail"
import { DossierMapHead, DossierMapPane, type MapView } from "@/components/frames/DossierMapPane"
import { DossierNotice } from "@/components/frames/DossierNotice"
import { DossierRemedyDrawer, type DossierRemedyDrawerProps } from "@/components/frames/DossierRemedyDrawer"
import { PaneBody } from "@/components/frames/PaneBody"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { BrainPageHeaderView } from "@/modules/types"

/** The words of the dossiers tab: those of its list, of the open dossier, and of its notices. */
interface DossierCopy extends DossierMainCopy, DossierListCopy {
    readonly grid: string
    readonly detailLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly closeAside: string
    readonly mapDescription: string
}

/** The import of a checklist: the entry in the head and the dialog it opens. */
interface ChecklistView {
    readonly label: string
    readonly dialog: ChecklistImportDialogProps["props"] | null
}

/** Props for {@link BrainDossiersBase}. */
export interface BrainDossiersBaseProps {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly panelId: string
        readonly copy: DossierCopy
        readonly mode: DossierMode
        readonly desk: DossierDeskView
        /** The findings of the open dossier; null while none is open. */
        readonly findings: DossierFindingsPane | null
        /** The draft drawer the address may open over the open dossier. */
        readonly remedy: DossierRemedyDrawerProps
        readonly checklist: ChecklistView | null
        /** The map view of the tab; null in the list view. */
        readonly map: MapView | null
        /** The task that gives the open dossier to a member with a date; null while it is closed. */
        readonly ownerDialog: FindingDialogView | null
        readonly isAsideOpen: boolean
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly setMode: (mode: DossierMode) => void
        readonly setQuery: (value: string) => void
        readonly select: (id: string) => void
        readonly back: () => void
        readonly retry: () => void
        readonly closeAside: () => void
        readonly asideOpenChange: (isOpen: boolean) => void
        readonly openMap: () => void
        readonly openSources: () => void
        readonly openDocument: (id: string) => void
        readonly openImport: () => void
        readonly pickImport: (files: Array<File>) => void
        readonly confirmImport: () => void
        readonly closeImport: () => void
        readonly setFilter: (value: string) => void
        readonly review: () => void
        readonly act: (findingId: string, action: FindingAction) => void
        readonly loadMore: () => void
        readonly submitDialog: (values: FindingDialogValues) => void
        readonly closeDialog: () => void
        readonly selectNode: (id: string | null) => void
        readonly setMapFilter: (value: string | null) => void
        readonly openHref: (href: string) => void
        readonly openAssign: () => void
        readonly submitOwner: (values: FindingDialogValues) => void
        readonly closeOwner: () => void
    }
}

/** The list pane: the switch, the figures, the search and the rows, with the checklist dialog the head opens over it. */
const ListBody = (props: BrainDossiersBaseProps) => {
    const { copy, desk, checklist } = props.props
    const dialog = checklist?.dialog ?? null
    const on = { pick: props.on.pickImport, confirm: props.on.confirmImport, close: props.on.closeImport }
    return (
        <PaneBody
            isWaiting={desk.isWaiting}
            overlay={dialog === null ? null : <ChecklistImportDialog props={dialog} on={on} />}
        >
            <DossierList
                view={desk.list}
                copy={copy}
                mode={props.props.mode}
                isWaiting={desk.isWaiting}
                onMode={props.on.setMode}
                onQuery={props.on.setQuery}
                onSelect={props.on.select}
            />
        </PaneBody>
    )
}

/** The head band over the main pane: the open dossier, or the map and its status filter. */
const HeadOf = (props: BrainDossiersBaseProps) => {
    const { copy, desk, findings, map } = props.props
    const { on } = props
    if (map !== null) {
        return (
            <DossierMapHead
                view={map}
                copy={{ title: copy.viewMap, description: copy.mapDescription, back: copy.back }}
                onFilter={on.setMapFilter}
                onBack={on.back}
            />
        )
    }
    return (
        <DossierHeadBand
            head={desk.head}
            findings={findings}
            copy={copy}
            isWaiting={desk.isWaiting}
            onBack={on.back}
            onReview={on.review}
            onOpenMap={on.openMap}
            onAssign={on.openAssign}
        />
    )
}

/** The body of the open dossier: its findings and dialogs, and the draft drawer the address may open over them. */
const DossierBody = (props: BrainDossiersBaseProps) => {
    const { copy, desk, findings, remedy, ownerDialog } = props.props
    const { on } = props
    if (findings === null) return null
    return (
        <PaneBody isWaiting={desk.isWaiting} overlay={<DossierRemedyDrawer {...remedy} />}>
            <DossierMainBody
                findings={findings}
                ownerDialog={ownerDialog}
                copy={{
                    statusLine: `${findings.frame.reviewedLine} · ${desk.head?.documentCount ?? ""}`,
                    findingOptions: copy.findingOptions,
                    emptyFindings: copy.emptyFindings,
                    filtersMore: copy.filtersMore,
                }}
                isWaiting={desk.isWaiting}
                onFilter={on.setFilter}
                onAction={on.act}
                onLoadMore={on.loadMore}
                onRetry={on.retry}
                onSubmitDialog={on.submitDialog}
                onCloseDialog={on.closeDialog}
                onSubmitOwner={on.submitOwner}
                onCloseOwner={on.closeOwner}
            />
        </PaneBody>
    )
}

/** The main pane: the map, the findings of the open dossier, or the notice that asks for a choice. */
const MainOf = (props: BrainDossiersBaseProps) => {
    const { copy, desk, findings, map } = props.props
    if (map !== null) {
        return (
            <PaneBody isWaiting={desk.isWaiting}>
                <DossierMapPane view={map} onSelect={props.on.selectNode} onRetry={props.on.retry} />
            </PaneBody>
        )
    }
    if (desk.head === null || findings === null) {
        return (
            <PaneBlank
                message={desk.list.isFiltered ? copy.noMatchTitle : copy.pickTitle}
                description={desk.list.isFiltered ? copy.noMatchBody : copy.pickBody}
                iconSource={nivoIconSource("brain", "leading")}
            />
        )
    }
    return <DossierBody {...props} />
}

/** The side pane: the selected node of the map, or the open dossier. */
const AsideOf = (props: BrainDossiersBaseProps) => {
    const { copy, desk, map } = props.props
    if (map !== null) {
        return <DossierMapDetail detail={map.detail} isWaiting={desk.isWaiting} onOpen={props.on.openHref} />
    }
    if (desk.aside === null) return null
    return (
        <DossierAside
            aside={desk.aside}
            isWaiting={desk.isWaiting}
            close={{ label: copy.closeAside, onPress: props.on.closeAside }}
            onOpenDocument={props.on.openDocument}
        />
    )
}

/**
 * Draws the dossiers tab (and its map view) as a panes page: the Second Brain header, then the list of dossiers by category with
 * the figures of the whole set, beside the open dossier with its findings and side pane, or the map. A phone shows the list, or the
 * open dossier or node with a way back. Every region draws its skeleton at the first read, together.
 */
export const BrainDossiersBase = (props: BrainDossiersBaseProps) => {
    const { copy, desk, map, checklist } = props.props
    const { on } = props
    const grid = map === null || desk.isWhole ? desk.grid : map.grid
    const aside = map === null ? desk.aside : map.detail
    const { header } = props.props
    const head = {
        ...header.heading,
        actions: (
            <DossierHeaderActions
                importEntry={checklist === null ? null : { label: checklist.label, onPress: on.openImport }}
                review={header.actions.review}
                onReview={on.reviewAll}
            />
        ),
        tabs: brainHeaderTabs({ tabs: header.tabs, onSelect: on.selectTab }),
    }
    return (
        <Page chrome="panes" header={head} measure="product">
            <PaneGrid
                label={copy.grid}
                role="tabpanel"
                id={props.props.panelId}
                areas={grid.areas}
                columns={grid.columns}
                rows={grid.rows}
            >
                {desk.isWhole ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <DossierNotice
                            list={desk.list}
                            errorBody={copy.errorBody}
                            emptyBody={copy.emptyBody}
                            emptyIconSource={nivoIconSource("brain", "leading")}
                            emptyAction={{ label: copy.emptyAction, onAction: on.openSources }}
                            onRetry={on.retry}
                        />
                    </Pane>
                ) : null}
                {desk.isWhole ? null : (
                    <Pane area="list" surface scroll label={copy.listLabel}>
                        <ListBody {...props} />
                    </Pane>
                )}
                {desk.isWhole ? null : (
                    <Pane area="head" surface>
                        <HeadOf {...props} />
                    </Pane>
                )}
                {desk.isWhole ? null : (
                    <Pane area="main" surface scroll label={copy.detailLabel}>
                        <MainOf {...props} />
                    </Pane>
                )}
                {desk.isWhole || aside === null ? null : (
                    <Pane
                        area="aside"
                        surface
                        scroll
                        label={aside.title}
                        collapse="drawer"
                        collapseLabel={aside.title}
                        openLabel={aside.title}
                        closeLabel={copy.closeAside}
                        isOpen={props.props.isAsideOpen}
                        onOpenChange={on.asideOpenChange}
                    >
                        <AsideOf {...props} />
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
