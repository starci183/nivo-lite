import type { ContentViews, ContentActions } from "@/modules/types"

type ContentQueueViewProps = ContentViews["queueFields"] & {
    readonly on: ContentActions["queueActions"]
    readonly isLoading: boolean
}
import { Alert, EmptyNotice, Stack, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { ContentChannelBadges } from "@/components/leaves/ContentChannelBadges"
import { ContentPostFacts } from "@/components/leaves/ContentPostFacts"
import { ContentQueueCard } from "@/components/leaves/ContentQueueCard"

/** Draws the posts waiting for the owner decision (the publish_post gate), then the approved ones that are ready to post. */
export const ContentQueueView = (props: ContentQueueViewProps) => {
    const { copy } = props
    const readyRows: ReadonlyArray<ListRowData> = props.ready.map((item) => ({
        id: item.id,
        title: item.title,
        action: { label: copy.postedTitle, intent: "alternative", press: () => props.on.open(item.id) },
        detail: (
            <Stack gap="identity">
                <ContentChannelBadges labels={item.channels} />
                <ContentPostFacts post={item} showBrief={false} showPillar={false} noPillar={copy.noPillar} />
            </Stack>
        ),
    }))
    return (
        <Stack gap="row">
            <Alert title={copy.queueWhy} tone="informative" />
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                ariaLabel={copy.tabQueue}
                empty={<EmptyNotice message={copy.queueEmptyTitle} description={copy.queueEmptyBody} />}
                items={props.waiting.map((item) => ({
                    id: item.post.id,
                    title: item.post.title,
                    description: item.post.when,
                    detail: (
                        <ContentQueueCard
                            isLoading={props.isLoading}
                            post={item.post}
                            quotes={item.quotes}
                            hasDecision={item.hasDecision}
                            canDecide={props.canDecide}
                            isPending={props.isPending}
                            busy={props.busy?.id === item.post.id ? props.busy.decision : null}
                            note={props.notes[item.post.id]}
                            copy={props.copy}
                            onDecide={props.on.decide}
                            onOpen={props.on.open}
                        />
                    ),
                }))}
            />
            {props.ready.length > 0 ? (
                <SurfaceCard
                    isLoading={props.isLoading}
                    kind="list"
                    label={copy.readyTitle}
                    headingLevel={2}
                    items={readyRows}
                    empty={<EmptyNotice message={copy.queueEmptyTitle} description={copy.queueEmptyBody} />}
                />
            ) : null}
        </Stack>
    )
}
