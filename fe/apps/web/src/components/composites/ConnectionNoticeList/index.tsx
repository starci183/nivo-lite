import { Alert, Stack, type PresentationState } from "@starci/grammar/common"

/** One notice of a connection page: why it cannot work, a refused command, or the one step left. */
interface ConnectionNoticeRow {
    readonly id: string
    readonly tone: PresentationState
    readonly title: string
    readonly description?: string
    /** A command beside the notice (read the page again when it could not be read). */
    readonly action?: { readonly label: string; readonly run: () => void }
}

/** What the notice list draws. */
interface ConnectionNoticeListProps {
    readonly notices: ReadonlyArray<ConnectionNoticeRow>
}

/** The notices of a connection page in reading order, one alert each; nothing when there is none. */
export const ConnectionNoticeList = (props: ConnectionNoticeListProps) =>
    props.notices.length === 0 ? null : (
        <Stack gap="row">
            {props.notices.map((notice) => (
                <Alert
                    key={notice.id}
                    tone={notice.tone}
                    title={notice.title}
                    {...(notice.description === undefined ? {} : { description: notice.description })}
                    {...(notice.action === undefined
                        ? {}
                        : { action: { label: notice.action.label, onAction: notice.action.run } })}
                />
            ))}
        </Stack>
    )
