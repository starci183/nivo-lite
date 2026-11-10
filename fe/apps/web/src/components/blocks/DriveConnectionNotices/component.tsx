import { ConnectionNoticeList } from "@/components/composites/ConnectionNoticeList"
import { ConnectionBandRefusal } from "@/components/frames/ConnectionBand"
import type { ConnectionNotice, ConnectionRefusalView } from "@/modules/types"

/** The notices that open the main column of the Google Drive page. */
export interface DriveConnectionNoticesBaseProps {
    readonly props: {
        readonly notices: ReadonlyArray<ConnectionNotice>
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
    }
}

/** Draws the refusal for a member who may not read the page, else the notices in reading order; nothing when there is none. */
export const DriveConnectionNoticesBase = (props: DriveConnectionNoticesBaseProps) => (
    <>
        <ConnectionBandRefusal refusal={props.props.refusal} />
        <ConnectionNoticeList notices={props.props.notices} />
    </>
)
