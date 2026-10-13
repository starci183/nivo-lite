import { Button } from "@starci/grammar/common"

/** Copy of the "new video" command. */
export interface VideoNewLinkBaseProps {
    readonly props: { readonly label: string; readonly href: string }
}

/** Draws the page command that opens the wizard on a new video. */
export const VideoNewLinkBase = (props: VideoNewLinkBaseProps) => (
    <Button variant="primary" href={props.props.href}>
        {props.props.label}
    </Button>
)
