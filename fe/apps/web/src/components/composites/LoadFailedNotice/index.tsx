import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** What a surface says when its data could not be read. */
type LoadFailedNoticeProps = {
    readonly title: string
    readonly body: string
}

/** A card with one notice: the surface keeps its frame and says what failed. */
export const LoadFailedNotice = (props: LoadFailedNoticeProps) => (
    <SurfaceCard ariaLabel={props.title}>
        <EmptyNotice message={props.title} description={props.body} />
    </SurfaceCard>
)
