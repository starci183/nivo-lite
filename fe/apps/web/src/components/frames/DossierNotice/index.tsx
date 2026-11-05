import { PaneSection } from "@starci/grammar/common"
import type { IconSource } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DossierDeskView } from "@/hooks/brain"

/** What the notice that takes the whole page says and calls. */
interface DossierNoticeProps {
    readonly list: DossierDeskView["list"]
    readonly errorBody: string
    readonly emptyBody: string
    readonly emptyIconSource: IconSource
    readonly emptyAction: { readonly label: string; readonly onAction: () => void }
    readonly onRetry: () => void
}

/** The notice that takes the whole page: nothing is tracked yet (and the way to add documents), or the page did not read. */
export const DossierNotice = (props: DossierNoticeProps) => (
    <PaneSection align="center" grow>
        <SlotView
            slot={props.list.slot}
            placeholder={[]}
            labels={props.list.slotLabels}
            errorDescription={props.errorBody}
            emptyDescription={props.emptyBody}
            emptyIconSource={props.emptyIconSource}
            emptyAction={props.emptyAction}
            onRetry={props.onRetry}
            render={() => null}
        />
    </PaneSection>
)
