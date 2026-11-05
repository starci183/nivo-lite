import { Button, IconButton, Page, Pane, PaneGrid, PaneSection } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { PublicDraftBody } from "@/components/composites/PublicDraftBody"
import { KnowledgeDocList } from "@/components/frames/KnowledgeDocList"
import { PaneBody } from "@/components/frames/PaneBody"
import { PublicAsksAside } from "@/components/frames/PublicAsksAside"
import { PublicDraftHead } from "@/components/frames/PublicDraftHead"
import { PublicDraftPickerDrawer } from "@/components/frames/PublicDraftPickerDrawer"
import { PublicWriteDrawer } from "@/components/frames/PublicWriteDrawer"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import type { PublicBrainView, PublicDraftView, PublicPickerDrawerView, PublicWriteDrawerView } from "@/modules/types"
import { COMPOSE_ICON_CLASS_NAME, COMPOSE_WORDS_CLASS_NAME } from "./classNames"

/** The words, values and drawers the connected public documents screen supplies. */
export interface PublicBrainBaseProps {
    readonly props: PublicBrainView["props"] & {
        readonly picker: PublicPickerDrawerView | null
        readonly writer: PublicWriteDrawerView | null
    }
    readonly on: PublicBrainView["on"]
}

/** The compose command of the page head: the words from the medium width, the icon alone on a phone. */
/** What the compose command draws. */
interface ComposeActionProps {
    readonly view: PublicBrainView["props"]
}

const ComposeAction = (props: ComposeActionProps) => {
    const { canWrite, composeHref, copy } = props.view
    if (!canWrite) return null
    return (
        <>
            <div className={COMPOSE_WORDS_CLASS_NAME}>
                <Button
                    intent="alternative"
                    href={composeHref}
                    startContent={<Icon props={{ name: "add", usage: "leading" }} />}
                >
                    {copy.composeLabel}
                </Button>
            </div>
            <div className={COMPOSE_ICON_CLASS_NAME}>
                <IconButton
                    intent="alternative"
                    source={nivoIconSource("add", "leading")}
                    label={copy.composeLabel}
                    href={composeHref}
                />
            </div>
        </>
    )
}

/** The head band over the open document; while nothing is open (or its read failed) it asks for a choice. */
const HeadOf = (props: PublicBrainBaseProps) => {
    const { opened, copy, isWaiting } = props.props
    if (opened === null) {
        return <PaneHead title={copy.listTitle} headingLevel={1} back={{ label: copy.back, onPress: props.on.back }} />
    }
    return (
        <PublicDraftHead
            draft={opened.draft}
            copy={copy}
            isLoading={isWaiting || opened.isLoading}
            canWrite={props.props.canWrite}
            isRemoveOpen={props.props.isRemoveOpen}
            isRemoving={props.props.isRemoving}
            onBack={props.on.back}
            onMenu={props.on.menu}
            onRemoveOpenChange={props.on.removeOpenChange}
            onRemove={props.on.remove}
        />
    )
}

/** The decisions the owner takes over the open document, pinned under it: later, save, draft again, approve. */
/** What the decisions over the open document draw. */
interface DecisionsProps extends PublicBrainBaseProps {
    readonly draft: PublicDraftView
}

const Decisions = (props: DecisionsProps) => {
    const { form, copy } = props.props
    const { draft } = props
    const pending = form.pendingAction
    return (
        <PaneSection as="footer" align="center">
            <Button intent="alternative" isDisabled={form.isBusy} onPress={props.on.back}>
                {copy.laterLabel}
            </Button>
            {draft.canEdit ? (
                <Button intent="neutral" isPending={pending === "save"} onPress={props.on.save}>
                    {copy.saveLabel}
                </Button>
            ) : null}
            {draft.redraftLabel === null ? null : (
                <Button
                    intent="neutral"
                    startContent={<Icon props={{ name: "sparkle", usage: "leading" }} />}
                    isPending={pending === "redraft"}
                    onPress={props.on.redraft}
                >
                    {draft.redraftLabel}
                </Button>
            )}
            {draft.approveLabel === null ? null : (
                <Button intent="commit" isPending={pending === "approve"} onPress={props.on.approve}>
                    {draft.approveLabel}
                </Button>
            )}
        </PaneSection>
    )
}

/** What the scrolling body of the middle pane draws. */
interface DraftBodyProps extends PublicBrainBaseProps {
    readonly slot: Extract<PublicBrainView["props"]["main"], { kind: "doc" }>
}

/** The scrolling body of the middle pane: the open document as an editable draft. */
const DraftBody = (props: DraftBodyProps) => {
    const { copy, isWaiting } = props.props
    return (
        <PaneSection scroll={{ label: copy.listLabel }} gap="section" isLoading={isWaiting}>
            <SlotView
                slot={props.slot.slot}
                placeholder={[props.props.placeholder]}
                labels={props.props.list.slotLabels}
                errorDescription={copy.errorBody}
                errorLayout="band"
                onRetry={props.on.retry}
                render={(drafts, isLoading) =>
                    drafts.map((draft) => (
                        <PublicDraftBody
                            key={draft.id}
                            draft={draft}
                            form={props.props.form}
                            copy={copy}
                            isLoading={isLoading}
                            onTitle={props.on.setTitle}
                            onBody={props.on.setBody}
                            onSubmit={props.on.approve}
                        />
                    ))
                }
            />
        </PaneSection>
    )
}

/** The list pane body: the list with the drawers that start a document over it. */
const ListBody = (props: PublicBrainBaseProps) => {
    const view = props.props
    return (
        <PaneBody
            isWaiting={view.isWaiting}
            overlay={
                <>
                    {view.picker === null ? null : <PublicDraftPickerDrawer {...view.picker} />}
                    {view.writer === null ? null : <PublicWriteDrawer {...view.writer} />}
                </>
            }
        >
            <KnowledgeDocList
                list={view.list}
                copy={view.copy}
                isWaiting={view.isWaiting}
                onSelect={props.on.select}
                onSearch={props.on.search}
                onTab={props.on.setTab}
                onClear={props.on.clear}
                {...(view.canWrite ? { onAdd: props.on.compose } : {})}
                onRetry={props.on.retry}
            />
        </PaneBody>
    )
}

/**
 * Draws the public documents of the Second Brain as the page of its tab: the header with its tab strip, then three panes. The list
 * (search, filter tabs with counts, one row per document) runs the whole height; the middle pane opens a document as an editable draft
 * with its decisions pinned under it (one filled command: approve and publish); the side pane lists the customer questions nobody
 * answered. Starting a document is one command and a drawer over the list. A phone shows the list, or the open document with a way
 * back; every region draws its skeleton at the same time while the first read waits.
 */
export const PublicBrainBase = (props: PublicBrainBaseProps) => {
    const view = props.props
    const grid = view.grid
    return (
        <Page
            chrome="panes"
            header={{
                ...view.header.heading,
                actions: (
                    <>
                        <ComposeAction view={view} />
                        <BrainHeaderActions
                            review={view.header.actions.review}
                            add={null}
                            onReview={props.on.reviewAll}
                        />
                    </>
                ),
                tabs: brainHeaderTabs({ tabs: view.header.tabs, onSelect: props.on.selectTab }),
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
                    <ListBody {...props} />
                </Pane>
                <Pane area="head" surface>
                    <HeadOf {...props} />
                </Pane>
                <Pane area="main" label={view.copy.listLabel}>
                    {view.main.kind === "none" ? (
                        <PaneBlank
                            message={view.copy.pickTitle}
                            description={view.copy.pickBody}
                            iconSource={nivoIconSource("view", "leading")}
                        />
                    ) : (
                        <DraftBody {...props} slot={view.main} />
                    )}
                    {view.decided === null ? null : <Decisions {...props} draft={view.decided} />}
                </Pane>
                <Pane
                    area="aside"
                    surface
                    scroll
                    label={view.copy.asideTitle}
                    collapse="drawer"
                    trigger="head"
                    collapseLabel={view.copy.asideTitle}
                    closeLabel={view.copy.closeAside}
                >
                    <PublicAsksAside
                        asks={view.asks}
                        labels={view.asksLabels}
                        copy={view.copy}
                        canWrite={view.canWrite}
                        isWaiting={view.isWaiting}
                        onSkip={props.on.skipAsk}
                        onRetry={props.on.retry}
                    />
                </Pane>
            </PaneGrid>
        </Page>
    )
}
