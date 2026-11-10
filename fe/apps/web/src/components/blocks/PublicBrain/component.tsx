import { Button, IconButton, Page, Stack } from "@starci/grammar/common"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { PublicAsksCard } from "@/components/frames/PublicAsksCard"
import { PublicDocDrawer } from "@/components/frames/PublicDocDrawer"
import { PublicDocsTable } from "@/components/frames/PublicDocsTable"
import { PublicDraftPickerDrawer } from "@/components/frames/PublicDraftPickerDrawer"
import { PublicWriteDrawer } from "@/components/frames/PublicWriteDrawer"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { PublicBrainView, PublicPickerDrawerView, PublicWriteDrawerView } from "@/modules/types"
import { COMPOSE_ICON_CLASS_NAME, COMPOSE_WORDS_CLASS_NAME } from "./classNames"

/** The words, values and drawers the connected public documents screen supplies. */
export interface PublicBrainBaseProps {
    readonly props: PublicBrainView["props"] & {
        readonly picker: PublicPickerDrawerView | null
        readonly writer: PublicWriteDrawerView | null
    }
    readonly on: PublicBrainView["on"]
}

/** What the compose command draws. */
interface ComposeActionProps {
    readonly view: PublicBrainView["props"]
}

/** The compose command of the page head: the words from the medium width, the icon alone on a phone. */
const ComposeAction = (props: ComposeActionProps) => {
    const { canWrite, composeHref, copy } = props.view
    if (!canWrite) return null
    return (
        <>
            <div className={COMPOSE_WORDS_CLASS_NAME}>
                <Button
                    intent="alternative"
                    href={composeHref}
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

/** The drawers over the page: the one that starts a document, and the one that opens the document the address names. */
const Overlay = (props: PublicBrainBaseProps) => {
    const view = props.props
    return (
        <>
            {view.picker === null ? null : <PublicDraftPickerDrawer {...view.picker} />}
            {view.writer === null ? null : <PublicWriteDrawer {...view.writer} />}
            <PublicDocDrawer props={view} on={props.on} />
        </>
    )
}

/**
 * Draws the public documents of the Second Brain as the page of its tab: the header with its tab strip, then, in the same page
 * measure as the other tabs, the customer questions nobody answered yet over the table of the public documents. A row opens the
 * document in a drawer as an editable draft with its sources and what was left out, and one filled command (approve and publish). Starting a document is one
 * command and a drawer over the page; every region draws its skeleton at the same time while the first read waits.
 */
export const PublicBrainBase = (props: PublicBrainBaseProps) => {
    const view = props.props
    return (
        <Page
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
            <Stack gap="section">
                <PublicAsksCard
                    asks={view.asks}
                    copy={view.copy}
                    canWrite={view.canWrite}
                    onSkip={props.on.skipAsk}
                />
                <PublicDocsTable
                    table={view.table}
                    copy={view.copy}
                    onCompose={view.canWrite ? props.on.compose : undefined}
                    onSearch={props.on.search}
                    onTab={props.on.setTab}
                    onClear={props.on.clear}
                />
                <Overlay {...props} />
            </Stack>
        </Page>
    )
}
