import { Alert, PaneSection } from "@starci/grammar/common"
import { ConnectionPaneLayoutNotice } from "@/components/frames/ConnectionPaneLayout"
import type { ConnectionNotice, ConnectionRefusalView } from "@/modules/types"

/** The notices that open the main pane of a provider page. */
export interface ConnectionPageNoticesBaseProps {
    readonly props: {
        readonly notices: ReadonlyArray<ConnectionNotice>
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
    }
}

/** Draws the refusal for a member who may not read the page, else the notices in reading order; nothing when there is none. */
export const ConnectionPageNoticesBase = (props: ConnectionPageNoticesBaseProps) => (
    <>
        <ConnectionPaneLayoutNotice refusal={props.props.refusal} />
        {props.props.notices.length === 0 ? null : (
            <PaneSection>
                {props.props.notices.map((notice) => (
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
            </PaneSection>
        )}
    </>
)
