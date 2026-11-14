import { AlertDialog, Button, Cluster, SurfaceCard, type FooterZone } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DocumentReleasePanelView, DocumentReleaseView } from "@/modules/types"

/** The anchor of the points block, where "see the points" leads. */
const QUESTIONS_HREF = "#document-questions"

/** Props for {@link DocumentReleaseBase}. */
export interface DocumentReleaseBaseProps {
    readonly props: DocumentReleasePanelView
    readonly on: {
        /** Serves the passages that wait for the review; the dialog stays open until it settles. */
        readonly release: () => Promise<void>
        readonly retry: () => void
    }
}

/** What the commands under the rows draw. */
interface CommandsProps {
    readonly view: DocumentReleaseView
    readonly isLoading: boolean
    readonly onRelease: () => Promise<void>
}

/**
 * The commands under the rows: "Release", the page's one red command, only for the owner while passages wait for the review, and "See N
 * points" as a neutral small button to the points. Release asks first: it serves only the passages that wait for the review, never the held ones.
 */
const Commands = (props: CommandsProps) => {
    const { view } = props
    return (
        <Cluster gap="inline">
            {view.release === null ? null : (
                <AlertDialog
                    tone="informative"
                    title={view.release.confirm.title}
                    description={view.release.confirm.description}
                    confirmLabel={view.release.confirm.confirmLabel}
                    cancelLabel={view.release.confirm.cancelLabel}
                    isConfirmPending={view.release.isPending}
                    onConfirm={props.onRelease}
                    trigger={
                        <Button intent="commit" isLoading={props.isLoading} isPending={view.release.isPending}>
                            {view.release.label}
                        </Button>
                    }
                />
            )}
            {view.seePoints === null ? null : (
                <Button intent="neutral" size="sm" href={QUESTIONS_HREF} isLoading={props.isLoading}>
                    {view.seePoints}
                </Button>
            )}
        </Cluster>
    )
}

/** The footer zone of the card: its commands; none, no zone. */
const footersOf = (view: DocumentReleaseView, isLoading: boolean, onRelease: () => Promise<void>): ReadonlyArray<FooterZone> =>
    view.release === null && view.seePoints === null
        ? []
        : [{ kind: "custom", children: <Commands view={view} isLoading={isLoading} onRelease={onRelease} /> }]

/**
 * What customers may read of one document (the card says it in its head: "9 passages customers can read") and what holds the rest, as
 * name/value rows: the passages held under an open point and the passages that wait for the review (only the rows with a count; one row
 * when everything is served), with the commands under them.
 */
export const DocumentReleaseBase = (props: DocumentReleaseBaseProps) => {
    const { slot, placeholder, slotLabels, errorBody } = props.props
    return (
        <SlotView
            slot={slot}
            placeholder={placeholder}
            labels={slotLabels}
            errorDescription={errorBody}
            empty="collapse"
            emptyIconSource={nivoIconSource("brain", "leading")}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <SurfaceCard
                    kind="list"
                    layout="keyValue"
                    label={view.title}
                    fact={view.readable}
                    isLoading={isLoading}
                    items={view.rows.map((row) => ({ id: row.id, title: row.term, value: row.value }))}
                    footers={footersOf(view, isLoading, props.on.release)}
                    empty={null}
                />
            )}
        />
    )
}
