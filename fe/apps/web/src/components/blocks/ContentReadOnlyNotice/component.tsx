import { Alert } from "@starci/grammar/common"

/** The words of the notice. */
export interface ContentReadOnlyNoticeBaseProps {
    readonly props: {
        readonly title: string
    }
}

/** Draws the notice that the member can read but not change the content settings. */
export const ContentReadOnlyNoticeBase = (props: ContentReadOnlyNoticeBaseProps) => (
    <Alert title={props.props.title} tone="informative" />
)
