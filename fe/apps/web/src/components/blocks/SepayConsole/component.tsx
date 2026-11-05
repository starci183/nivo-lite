import { type BadgeTone, type DropdownMenuEntry } from "@starci/grammar/common"
import { ConnectionHeadBand, connectionRefusedTitleOf } from "@/components/frames/ConnectionPaneLayout"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import type { ConnectionRefusalView } from "@/modules/types"

/** What the header shows once the connection is read. */
export interface SepayHeaderView {
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly environmentLabel: string
    readonly environmentTone: BadgeTone
    readonly facts: string
}

/** The confirmation of a disconnect. */
interface SepayDisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}

/** Props for {@link SepayConsoleBase}. */
export interface SepayConsoleBaseProps {
    readonly props: {
        /** The connection read, or the same-shape placeholder while the read waits. */
        readonly view: SepayHeaderView
        readonly isLoading: boolean
        readonly markSrc: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        /** The words of the phone back control and of the "more" menu. */
        readonly backLabel: string
        readonly moreLabel: string
        /** The name of the button that opens the live rail drawer. */
        readonly railLabel: string
        /** Disconnect belongs to the workspace owner; absent for everyone else, whom the back end refuses. */
        readonly disconnect?: { readonly title: string; readonly description: string; readonly label: string }
        readonly isPending: boolean
        readonly confirm: SepayDisconnectConfirm
    }
    readonly on: {
        /** Opens the confirmation; nothing is disconnected until `confirmDisconnect`. */
        readonly askDisconnect: () => void
        readonly confirmDisconnect: () => void
        readonly dismiss: () => void
        readonly back: () => void
    }
}

/** The commands behind the "more" button: disconnect, which asks first; the owner only. */
const menuOf = (props: SepayConsoleBaseProps): ReadonlyArray<DropdownMenuEntry> => {
    const { disconnect } = props.props
    return disconnect === undefined
        ? []
        : [
              {
                  id: "disconnect",
                  label: disconnect.label,
                  tone: "danger",
                  isDisabled: props.props.isPending,
                  onAction: props.on.askDisconnect,
              },
          ]
}

/** The head band of a SePay connection: mark, name, status and environment chips, the provider facts, the menu and the question. */
export const SepayConsoleBase = (props: SepayConsoleBaseProps) => {
    const p = props.props
    const { view } = p
    return (
        <ConnectionHeadBand
            title={p.refusal === undefined ? view.name : connectionRefusedTitleOf(p.refusal)}
            facts={p.refusal === undefined ? view.facts : ""}
            mark={<ProviderLogo glyph="wallet" src={p.markSrc} />}
            statuses={[
                { label: view.statusLabel, tone: view.statusTone, isDot: true },
                { label: view.environmentLabel, tone: view.environmentTone },
            ]}
            isLoading={p.refusal === undefined && p.isLoading}
            back={{ label: p.backLabel, onPress: props.on.back }}
            menu={{ label: p.moreLabel, entries: menuOf(props) }}
            railLabel={p.railLabel}
            question={
                <SepayConfirm
                    {...p.confirm}
                    isPending={p.isPending}
                    onConfirm={props.on.confirmDisconnect}
                    onDismiss={props.on.dismiss}
                />
            }
        />
    )
}
