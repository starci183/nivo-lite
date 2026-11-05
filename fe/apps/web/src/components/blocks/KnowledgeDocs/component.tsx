import { Button, IconButton, Page, Pane, PaneGrid } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { KnowledgeDocAside } from "@/components/composites/KnowledgeDocAside"
import { KnowledgeDocBody, KnowledgeNivoBody } from "@/components/composites/KnowledgeDocBody"
import { KnowledgeDocHead } from "@/components/frames/KnowledgeDocHead"
import { KnowledgeDocList } from "@/components/frames/KnowledgeDocList"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { KnowledgeAddDrawer } from "@/components/frames/KnowledgeAddDrawer"
import { PaneBody } from "@/components/frames/PaneBody"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import type {
    DataSlot,
    DocBodyView,
    DocOpenedView,
    KnowledgeAddDrawerView,
    KnowledgeDocsView,
    NivoBodyView,
} from "@/modules/types"
import { ADD_ICON_CLASS_NAME, ADD_WORDS_CLASS_NAME } from "./classNames"

/** The words and values the connected documents screen supplies, and the drawer that adds documents. */
export interface KnowledgeDocsBaseProps {
    readonly props: KnowledgeDocsView["props"] & {
        /** The id of the panel the tab strip controls. */
        readonly panelId: string
        /** The drawer that adds documents, drawn over the list. */
        readonly drawer: KnowledgeAddDrawerView
    }
    readonly on: KnowledgeDocsView["on"]
}

type Props = KnowledgeDocsBaseProps

/** A document of the same shape as a ready one: the loading tree is the ready tree. */
const DOC_PLACEHOLDER: DocOpenedView<DocBodyView> = {
    head: {
        title: "-",
        meta: "-",
        glyph: "file",
        chips: [{ label: "-", tone: "neutral" }],
        reindex: { label: "-", isPending: false, isDisabled: false },
        menu: [{ id: "placeholder", label: "-" }],
        remove: null,
    },
    body: {
        note: null,
        stage: null,
        passages: {
            title: "-",
            count: "-",
            hint: "-",
            rows: [1, 2, 3].map((n) => ({ id: `p-${n}`, text: "-", chip: "-" })),
            emptyLabel: "-",
        },
        content: { title: "-", text: "-" },
    },
    facts: [1, 2, 3, 4].map((n) => ({ id: `f-${n}`, term: "-", text: "-" })),
}

/** An item of the base knowledge of the same shape as a ready one. */
const NIVO_PLACEHOLDER: DocOpenedView<NivoBodyView> = {
    head: { ...DOC_PLACEHOLDER.head, reindex: null, menu: [] },
    body: { noticeTitle: "-", noticeBody: "-", contentTitle: "-", lines: ["-", "-", "-"] },
    facts: DOC_PLACEHOLDER.facts,
}

/** The opened item, once its read settled to data or while it is still being read; null for every other state. */
const openedOf = <Body,>(slot: DataSlot<DocOpenedView<Body>>, placeholder: DocOpenedView<Body>) => {
    if ("items" in slot) return { opened: slot.items, isLoading: false }
    return "isLoading" in slot ? { opened: placeholder, isLoading: true } : null
}

/** The opened item of the middle pane, or null while nothing is open or its read did not settle to data. */
const foundOf = (main: Props["props"]["main"]) => {
    if (main.kind === "none") return null
    if (main.kind === "doc") return openedOf(main.slot, DOC_PLACEHOLDER)
    return openedOf(main.slot, NIVO_PLACEHOLDER)
}

/** The facts the side pane shows: the ones of the opened item, none while nothing is open. */
const factsOf = (main: Props["props"]["main"]) => {
    const found = foundOf(main)
    return found === null ? { facts: [], isLoading: false } : { facts: found.opened.facts, isLoading: found.isLoading }
}

/** What the add command of the page head reads. */
interface AddActionProps {
    readonly view: Props["props"]
}

/** The add command of the page head: the words from the medium width, the icon alone on a phone. */
const AddAction = (props: AddActionProps) => {
    const view = props.view
    if (!view.canAdd) return null
    return (
        <>
            <div className={ADD_WORDS_CLASS_NAME}>
                <Button
                    intent="commit"
                    href={view.addHref}
                    startContent={<Icon props={{ name: "upload", usage: "leading" }} />}
                >
                    {view.addLabel}
                </Button>
            </div>
            <div className={ADD_ICON_CLASS_NAME}>
                <IconButton
                    intent="alternative"
                    source={nivoIconSource("upload", "leading")}
                    label={view.addLabel}
                    href={view.addHref}
                />
            </div>
        </>
    )
}

/** The head band over the opened item; while nothing is open (or its read failed) the band asks for a choice. */
const HeadOf = (props: Props) => {
    const { main, copy, isWaiting } = props.props
    const found = foundOf(main)
    if (found === null) {
        return <PaneHead title={copy.pickTitle} headingLevel={1} back={{ label: copy.back, onPress: props.on.back }} />
    }
    return (
        <KnowledgeDocHead
            head={found.opened.head}
            backLabel={copy.back}
            moreLabel={copy.moreActions}
            isLoading={isWaiting || found.isLoading}
            isRemoveOpen={props.props.isRemoveOpen}
            onBack={props.on.back}
            onReindex={props.on.reindex}
            onMenu={props.on.menu}
            onRemoveOpenChange={props.on.removeOpenChange}
            onRemove={props.on.remove}
        />
    )
}

/** The body of the middle pane: the opened document, the opened item of the base knowledge, or the request to choose. */
const MainBody = (props: Props) => {
    const { main, copy, isWaiting } = props.props
    if (main.kind === "none") {
        return (
            <PaneBlank
                message={copy.pickTitle}
                description={copy.pickBody}
                iconSource={nivoIconSource("document", "leading")}
            />
        )
    }
    const labels = props.props.list.slotLabels
    return (
        <PaneBody isWaiting={isWaiting}>
            {main.kind === "doc" ? (
                <SlotView
                    slot={main.slot}
                    placeholder={DOC_PLACEHOLDER}
                    labels={labels}
                    errorDescription={copy.errorBody}
                    errorLayout="band"
                    onRetry={props.on.retry}
                    render={(opened, isLoading) => <KnowledgeDocBody body={opened.body} isLoading={isLoading} />}
                />
            ) : (
                <SlotView
                    slot={main.slot}
                    placeholder={NIVO_PLACEHOLDER}
                    labels={labels}
                    errorDescription={copy.errorBody}
                    errorLayout="band"
                    onRetry={props.on.retry}
                    render={(opened, isLoading) => <KnowledgeNivoBody body={opened.body} isLoading={isLoading} />}
                />
            )}
        </PaneBody>
    )
}

/** The side pane: its head with the close control, then the facts of the opened item and the suggestions. */
const AsideBody = (props: Props) => {
    const { copy, isWaiting } = props.props
    const shown = factsOf(props.props.main)
    return (
        <>
            <PaneHead
                title={copy.asideTitle}
                headingLevel={2}
                close={{ label: copy.closeAside, onPress: props.on.closeAside }}
                isLoading={isWaiting}
            />
            <PaneBody isWaiting={isWaiting}>
                <KnowledgeDocAside
                    facts={shown.facts}
                    ideas={props.props.ideas}
                    nextReview={props.props.nextReview}
                    isLoading={isWaiting || shown.isLoading}
                    onIdea={props.on.idea}
                    onMore={props.on.moreIdeas}
                />
            </PaneBody>
        </>
    )
}

/**
 * Draws the documents of the Second Brain as the page of its tab: the header with its tab strip, then three panes. The list
 * (search, filter tabs with counts, the agent, the rows) runs the whole height; the middle pane opens a document (its passages,
 * its text folded away) or an item of the base knowledge (read only); the side pane holds its facts and the documents worth
 * adding. Adding documents is a drawer over the list. A phone shows the list, or the opened item with a way back; every region
 * draws its skeleton at the same time while the first read waits.
 */
export const KnowledgeDocsBase = (props: KnowledgeDocsBaseProps) => {
    const view = props.props
    const grid = view.grid
    return (
        <Page
            chrome="panes"
            header={{
                ...view.header.heading,
                actions: <AddAction view={view} />,
                tabs: {
                    label: view.header.tabs.label,
                    items: view.header.tabs.items,
                    selectedKey: view.header.tabs.selectedKey,
                    labelVisibility: "always",
                    panelId: (key) => `${view.header.tabs.panelPrefix}${key}`,
                    onSelect: props.on.selectTab,
                },
            }}
            measure="product"
        >
            <PaneGrid
                label={view.copy.grid}
                role="tabpanel"
                id={view.panelId}
                areas={grid.areas}
                columns={grid.columns}
                rows={grid.rows}
            >
                <Pane area="list" surface scroll label={view.copy.listLabel}>
                    <PaneBody isWaiting={view.isWaiting} overlay={<KnowledgeAddDrawer {...view.drawer} />}>
                        <KnowledgeDocList
                            list={view.list}
                            copy={view.copy}
                            isWaiting={view.isWaiting}
                            onSelect={props.on.select}
                            onSearch={props.on.search}
                            onTab={props.on.setTab}
                            onModule={props.on.setModule}
                            onClear={props.on.clear}
                            {...(view.canAdd && view.list.tab !== "nivo" ? { onAdd: props.on.add } : {})}
                            onRetry={props.on.retry}
                        />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <HeadOf props={props.props} on={props.on} />
                </Pane>
                <Pane area="main" scroll label={view.copy.listLabel}>
                    <MainBody props={props.props} on={props.on} />
                </Pane>
                {view.hasAside ? (
                    <Pane
                        area="aside"
                        surface
                        scroll
                        label={view.copy.asideTitle}
                        collapse="drawer"
                        collapseLabel={view.copy.asideTitle}
                        openLabel={view.copy.asideTitle}
                        closeLabel={view.copy.closeAside}
                        isOpen={view.isAsideOpen}
                        onOpenChange={props.on.asideOpenChange}
                    >
                        <AsideBody props={props.props} on={props.on} />
                    </Pane>
                ) : null}
            </PaneGrid>
        </Page>
    )
}
