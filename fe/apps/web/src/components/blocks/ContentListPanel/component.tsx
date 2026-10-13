import { EmptyNotice, ListBox, SurfaceCard, TagGroup } from "@starci/grammar/common"
import { ContentPostFacts } from "@/components/leaves/ContentPostFacts"
import { ContentStatusBadge } from "@/components/leaves/ContentStatusBadge"
import type { ContentT, PostView } from "@/hooks/content"
import { PANEL_CLASS_NAME } from "./classNames"

/** What the list panel draws. */
export interface ContentListPanelBaseProps {
    readonly props: {
        readonly t: ContentT
        /** The posts to show, already filtered and ordered. */
        readonly shown: ReadonlyArray<PostView>
        readonly filters: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly filter: string
    }
    readonly on: {
        readonly filter: (id: string) => void
        readonly open: (id: string) => void
    }
}

/** Draws all posts, soonest first, with a status filter; each row opens the post. */
export const ContentListPanelBase = (props: ContentListPanelBaseProps) => {
    const { t } = props.props
    return (
        <div className={PANEL_CLASS_NAME}>
            <TagGroup
                label={t("filterLabel")}
                items={props.props.filters}
                selectionMode="single"
                selectedIds={[props.props.filter]}
                onSelectionChange={(ids) => props.on.filter(ids[0] ?? "all")}
            />
            <SurfaceCard ariaLabel={t("tabList")}>
                {props.props.shown.length === 0 ? (
                    <EmptyNotice message={t("listEmptyTitle")} description={t("listEmptyBody")} />
                ) : (
                    <ListBox
                        label={t("tabList")}
                        selectionMode="none"
                        onAction={props.on.open}
                        items={props.props.shown.map((i) => ({
                            id: i.id,
                            label: i.title,
                            description: <ContentPostFacts post={i} showBrief showPillar noPillar={t("noPillar")} />,
                            trailing: <ContentStatusBadge tone={i.tone} label={i.statusLabel} />,
                        }))}
                    />
                )}
            </SurfaceCard>
        </div>
    )
}
