import { AvatarButton, DropdownMenu } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The person and the entries the connected account menu supplies. */
export interface WorkspacesAccountBaseProps {
    readonly props: {
        /** The email of the signed-in person, once the session read arrived. */
        readonly slot: DataSlot<string>
        readonly labels: SlotLabels
        readonly entries: ReadonlyArray<DropdownMenuEntry>
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the account menu of the workspaces area: the control-size avatar, as in the console bar, opens Account and Sign out. */
export const WorkspacesAccountBase = (props: WorkspacesAccountBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder=""
        labels={props.props.labels}
        forbidden="hide"
        onRetry={props.on.retry}
    >
        {(email, isSkeleton) => (
            <DropdownMenu
                placement="bottom end"
                entries={props.props.entries}
                trigger={<AvatarButton size="control" name={email} seed={email} isDisabled={isSkeleton} />}
            />
        )}
    </SlotView>
)
