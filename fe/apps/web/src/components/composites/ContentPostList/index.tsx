import type { ContentViews, ContentActions } from "@/modules/types"

type ContentPostListProps = ContentViews["listFields"] & {
    readonly on: ContentActions["listActions"]
    readonly isLoading: boolean
}
import { EmptyNotice, FilterButtonGroup, ListBox, Stack, SurfaceCard } from "@starci/grammar/common"
import { ContentPostFacts } from "@/components/leaves/ContentPostFacts"
import { ContentStatusBadge } from "@/components/leaves/ContentStatusBadge"

/** Draws all posts, soonest first, with a status filter; each row opens the post. */
export const ContentPostList = (props: ContentPostListProps) => {
    const { copy } = props
    return (
        <Stack gap="row">
            <FilterButtonGroup
                isLoading={props.isLoading}
                label={copy.filterLabel}
                options={props.filters.map((filter) => ({ value: filter.id, label: filter.label }))}
                value={props.filter}
                onValueChange={props.on.filter}
            />
            <SurfaceCard isLoading={props.isLoading} ariaLabel={copy.tabList}>
                {props.isEmpty ? (
                    <EmptyNotice message={copy.listEmptyTitle} description={copy.listEmptyBody} />
                ) : (
                    <ListBox
                        isLoading={props.isLoading}
                        label={copy.tabList}
                        selectionMode="none"
                        onAction={props.on.open}
                        items={props.shown.map((i) => ({
                            id: i.id,
                            label: i.title,
                            description: <ContentPostFacts post={i} showBrief showPillar noPillar={copy.noPillar} />,
                            trailing: <ContentStatusBadge tone={i.tone} label={i.statusLabel} />,
                        }))}
                    />
                )}
            </SurfaceCard>
        </Stack>
    )
}
