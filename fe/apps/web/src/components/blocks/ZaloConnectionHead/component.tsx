import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionHeadBand, connectionRefusedTitleOf } from "@/components/frames/ConnectionPaneLayout"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionDisconnectDialog } from "@/components/branches/ConnectionDisconnectDialog"
import type { ConnectionRefusalView, ZaloHeadView } from "@/modules/types"

/** The confirmation of a disconnect. */
interface ZaloDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** The words and the state of the head band of a Zalo OA connection page. */
export interface ZaloConnectionHeadBaseProps {
    readonly props: {
        /** The head read, or the same-shape placeholder while the read waits. */
        readonly head: ZaloHeadView
        readonly isLoading: boolean
        /** The provider mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        /** The words of the phone back control and of the "more" menu. */
        readonly backLabel: string
        readonly moreLabel: string
        readonly recheckLabel: string
        readonly isRechecking: boolean
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnect?: { readonly title: string; readonly description: string; readonly label: string }
        readonly confirm: ZaloDisconnectConfirm
    }
    readonly on: {
        readonly recheck: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
        readonly back: () => void
    }
}

/** The commands behind the "more" button: disconnect, which asks first; the owner only. */
const menuOf = (props: ZaloConnectionHeadBaseProps): ReadonlyArray<DropdownMenuEntry> => {
    const { disconnect } = props.props
    return disconnect === undefined
        ? []
        : [{ id: "disconnect", label: disconnect.label, tone: "danger", onAction: props.on.askDisconnect }]
}

/** The head band of the OA: mark, name, status, facts, "Check again", the menu and the disconnect question. */
export const ZaloConnectionHeadBase = (props: ZaloConnectionHeadBaseProps) => {
    const p = props.props
    const view = p.head
    return (
        <ConnectionHeadBand
            title={p.refusal === undefined ? view.name : connectionRefusedTitleOf(p.refusal)}
            facts={p.refusal === undefined ? view.facts : ""}
            mark={<ProviderLogo glyph="chat" src={p.markSrc} />}
            statuses={[{ label: view.chipLabel, tone: view.chipTone, isDot: true }]}
            isLoading={p.refusal === undefined && p.isLoading}
            back={{ label: p.backLabel, onPress: props.on.back }}
            action={{ label: p.recheckLabel, intent: "neutral", isPending: p.isRechecking, onPress: props.on.recheck }}
            menu={{ label: p.moreLabel, entries: menuOf(props) }}
            question={
                <ConnectionDisconnectDialog
                    confirm={p.confirm}
                    onConfirm={props.on.confirmDisconnect}
                    onDismiss={props.on.dismiss}
                />
            }
        />
    )
}
