import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** The words of the failure card. */
export interface ContentWorkbenchStatusBaseProps {
    readonly props: {
        readonly title: string
        readonly body: string
    }
}

/** Draws the card shown when the workbench could not be read. */
export const ContentWorkbenchStatusBase = (props: ContentWorkbenchStatusBaseProps) => (
    <SurfaceCard ariaLabel={props.props.title}>
        <EmptyNotice message={props.props.title} description={props.props.body} />
    </SurfaceCard>
)
