import type { DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionHeadBand, connectionRefusedTitleOf } from "@/components/frames/ConnectionPaneLayout"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionDisconnectDialog } from "@/components/branches/ConnectionDisconnectDialog"
import type { ConnectionHeadView, ConnectionPageHeadView, ConnectionRefusalView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const HEAD_PLACEHOLDER: ConnectionHeadView = { name: "-", chipLabel: "-", chipTone: "neutral", facts: "-" }

/** The words and the state of the head band of a provider connection page. */
export interface ConnectionPageHeadBaseProps {
    readonly props: Pick<
        ConnectionPageHeadView,
        "head" | "isLoading" | "icon" | "action" | "disconnect" | "confirm"
    > & {
        /** The provider mark. */
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        /** The words of the phone back control and of the "more" menu. */
        readonly backLabel: string
        readonly moreLabel: string
    }
    readonly on: {
        readonly act: () => void
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
        readonly back: () => void
    }
}

/** The commands behind the "more" button: disconnect, which asks first; the owner only. */
const menuOf = (props: ConnectionPageHeadBaseProps): ReadonlyArray<DropdownMenuEntry> => {
    const { disconnect } = props.props
    return disconnect === undefined
        ? []
        : [{ id: "disconnect", label: disconnect.label, tone: "danger", onAction: props.on.askDisconnect }]
}

/** The head band of the page: the provider mark, the name and its chip, the facts, the one command, the menu and the disconnect question. */
export const ConnectionPageHeadBase = (props: ConnectionPageHeadBaseProps) => {
    const p = props.props
    const view = p.head ?? HEAD_PLACEHOLDER
    const action = p.action
    return (
        <ConnectionHeadBand
            title={p.refusal === undefined ? view.name : connectionRefusedTitleOf(p.refusal)}
            facts={p.refusal === undefined ? view.facts : ""}
            mark={<ProviderLogo glyph={p.icon} src={p.markSrc} />}
            statuses={[{ label: view.chipLabel, tone: view.chipTone, isDot: true }]}
            isLoading={p.refusal === undefined && p.isLoading}
            back={{ label: p.backLabel, onPress: props.on.back }}
            {...(action === undefined || p.head === undefined ? {} : { action: { ...action, onPress: props.on.act } })}
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
