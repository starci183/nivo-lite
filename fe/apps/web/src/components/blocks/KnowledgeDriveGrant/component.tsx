import { Alert } from "@starci/grammar/common"

/** What the button of a notice does: start the consent, or forget the grant. */
export type DriveNoticeAction = "grant" | "disconnect"

/** One notice of the Drive grant: its tone, words and the action it offers. */
export interface DriveNoticeView {
    readonly tone: "informative" | "affirmative" | "cautionary"
    readonly title: string
    readonly description?: string
    readonly actionLabel: string
    readonly action: DriveNoticeAction
}

/** What the Drive grant notice draws and the two actions it may offer. */
export interface KnowledgeDriveGrantBaseProps {
    readonly props: {
        /** The notice of the grant, or null when it is hidden. */
        readonly notice: DriveNoticeView | null
        /** The failure of the last consent or action, or null. */
        readonly failure: string | null
    }
    readonly on: {
        readonly grant: () => void
        readonly disconnect: () => void
    }
}

/** Draws the Google Drive read grant of the workspace: where it stands with its action, and the failure of the last try. */
export const KnowledgeDriveGrantBase = (props: KnowledgeDriveGrantBaseProps) => {
    const notice = props.props.notice
    return (
        <>
            {props.props.failure === null ? null : <Alert tone="negative" title={props.props.failure} />}
            {notice === null ? null : (
                <Alert
                    appearance="soft"
                    tone={notice.tone}
                    title={notice.title}
                    description={notice.description}
                    action={{ label: notice.actionLabel, onAction: props.on[notice.action] }}
                />
            )}
        </>
    )
}
