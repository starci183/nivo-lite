import { Alert, Button, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { ContentChannelBadges } from "@/components/leaves/ContentChannelBadges"
import { ContentPostFacts } from "@/components/leaves/ContentPostFacts"
import { ContentQueueCard } from "@/components/leaves/ContentQueueCard"
import type { ContentNote, ContentT, PostView, QuoteView } from "@/hooks/content"
import { PANEL_CLASS_NAME } from "./classNames"

/** A post waiting for the owner, with the text of each channel and whether a decision is open for it. */
export interface WaitingPost {
    readonly post: PostView
    readonly quotes: ReadonlyArray<QuoteView>
    readonly hasDecision: boolean
}

/** What the approvals panel draws. */
export interface ContentQueuePanelBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly waiting: ReadonlyArray<WaitingPost>
        readonly ready: ReadonlyArray<PostView>
        readonly canDecide: boolean
        readonly isPending: boolean
        /** The post being decided and the decision, or null. */
        readonly busy: { readonly id: string; readonly decision: "approved" | "rejected" } | null
        /** The outcome message of the last decision, by post id. */
        readonly notes: Readonly<Record<string, ContentNote>>
    }
    readonly on: {
        readonly decide: (id: string, decision: "approved" | "rejected") => void
        readonly open: (id: string) => void
    }
}

/** Draws the posts waiting for the owner decision (the publish_post gate), then the approved ones that are ready to post. */
export const ContentQueuePanelBase = (props: ContentQueuePanelBaseProps) => {
    const { t } = props.props
    const readyRows = props.props.ready.map((item) => (
        <ListRow
            key={item.id}
            title={item.title}
            badges={<ContentChannelBadges labels={item.channels} />}
            actions={
                <Button intent="alternative" size="sm" onPress={() => props.on.open(item.id)}>
                    {t("postedTitle")}
                </Button>
            }
            description={<ContentPostFacts post={item} showBrief={false} showPillar={false} noPillar={t("noPillar")} />}
        />
    ))
    return (
        <div className={PANEL_CLASS_NAME}>
            <Alert title={t("queueWhy")} tone="informative" />
            <SurfaceListCard
                ariaLabel={t("tabQueue")}
                empty={<EmptyNotice message={t("queueEmptyTitle")} description={t("queueEmptyBody")} />}
            >
                {props.props.waiting.map((item) => (
                    <ContentQueueCard
                        key={item.post.id}
                        post={item.post}
                        quotes={item.quotes}
                        hasDecision={item.hasDecision}
                        canDecide={props.props.canDecide}
                        isPending={props.props.isPending}
                        busy={props.props.busy?.id === item.post.id ? props.props.busy.decision : null}
                        note={props.props.notes[item.post.id]}
                        t={t}
                        onDecide={props.on.decide}
                        onOpen={props.on.open}
                    />
                ))}
            </SurfaceListCard>
            {props.props.ready.length > 0 ? (
                <SurfaceListCard label={t("readyTitle")} headingLevel={2}>
                    {readyRows}
                </SurfaceListCard>
            ) : null}
        </div>
    )
}
