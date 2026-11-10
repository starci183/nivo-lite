import { Alert, Stack } from "@starci/grammar/common"
import { ConnectionBandRefusal } from "@/components/frames/ConnectionBand"
import type { ConnectionNotice, ConnectionRefusalView } from "@/modules/types"

/** The notices that open the main column of a Telegram bot page. */
export interface TelegramConnectionNoticesBaseProps {
    readonly props: {
        /** The failure of the page read, why the bot cannot work, a refused command, a local site, no agent yet. */
        readonly notices: ReadonlyArray<Omit<ConnectionNotice, "action"> & { readonly actionLabel?: string }>
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the refusal for a member who may not read the page, else the notices in reading order; nothing when there is none. */
export const TelegramConnectionNoticesBase = (props: TelegramConnectionNoticesBaseProps) => (
    <>
        <ConnectionBandRefusal refusal={props.props.refusal} />
        {props.props.notices.length === 0 ? null : (
            <Stack gap="row">
                {props.props.notices.map((notice) => (
                    <Alert
                        key={notice.id}
                        tone={notice.tone}
                        title={notice.title}
                        {...(notice.description === undefined ? {} : { description: notice.description })}
                        {...(notice.actionLabel === undefined
                            ? {}
                            : { action: { label: notice.actionLabel, onAction: props.on.retry } })}
                    />
                ))}
            </Stack>
        )}
    </>
)
