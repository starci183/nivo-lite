import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** The words of the failure card. */
export interface VideoWorkbenchStatusBaseProps {
    readonly props: {
        readonly title: string
        readonly body: string
    }
}

/** Draws the card shown when the video workbench could not be read. */
export const VideoWorkbenchStatusBase = (props: VideoWorkbenchStatusBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title}>
        <EmptyNotice message={props.props.title} description={props.props.body} />
    </SurfaceCard>
)
