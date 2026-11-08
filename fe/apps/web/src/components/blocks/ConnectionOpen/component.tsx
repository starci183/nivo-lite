import { Pane, PaneGrid } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { ConnectionHeadBand } from "@/components/frames/ConnectionPaneLayout"
import { ConnectionRowBody, rowMenuEntriesOf, type RowCommandSet } from "@/components/frames/ConnectionRowBody"
import { PaneBody } from "@/components/frames/PaneBody"
import type { DataSlot, RowView, SlotLabels } from "@/modules/types"

/** The words and the state of the detail pane of a connection that has no page of its own. */
export interface ConnectionOpenBaseProps {
    readonly props: {
        readonly gridLabel: string
        readonly mainLabel: string
        readonly backLabel: string
        readonly moreLabel: string
        readonly slot: DataSlot<RowView>
        /** The view drawn while the read waits: same shape, no words. */
        readonly placeholder: RowView
        readonly labels: SlotLabels
    }
    readonly on: RowCommandSet & { readonly back: () => void; readonly retry: () => void }
}

/** What the head band reads: the connection's view, whether it is the placeholder, and the words and commands around it. */
interface HeadBandProps {
    readonly copy: ConnectionOpenBaseProps["props"]
    readonly on: ConnectionOpenBaseProps["on"]
    readonly view: RowView
    readonly isLoading: boolean
}

/** The head band: mark, name, status chips, what identifies the connection, its one command and the menu (disconnect or remove asks first). */
const HeadBand = (props: HeadBandProps) => {
    const { view, on } = props
    const primary = view.primary
    return (
        <ConnectionHeadBand
            title={view.title}
            facts={[view.facts, view.usedBy].filter(Boolean).join(" · ")}
            mark={<ProviderLogo {...view.logo} glyph="email" />}
            statuses={[
                { label: view.statusLabel, tone: view.statusTone, isDot: true },
                ...(view.envLabel === null ? [] : [{ label: view.envLabel, tone: "neutral" as const }]),
            ]}
            isLoading={props.isLoading}
            back={{ label: props.copy.backLabel, onPress: on.back }}
            {...(primary === null
                ? {}
                : {
                      action: {
                          label: primary.label,
                          intent: primary.intent,
                          isPending: primary.isPending,
                          onPress: () => on.primary(primary.id),
                      },
                  })}
            menu={{ label: props.copy.moreLabel, entries: rowMenuEntriesOf(view, on.menu) }}
        />
    )
}

/**
 * Draws the detail of a connection that has no page of its own (outgoing email, a webhook, Google Sheets, a data source) inside the
 * Connections frame: the same head band as the provider pages, then what the connection's row says (alerts, notes, the SMTP panel,
 * the keys, who may use it). There is no artboard for this pane: it reuses the band and the row's own content.
 */
export const ConnectionOpenBase = (props: ConnectionOpenBaseProps) => {
    return (
        <PaneGrid label={props.props.gridLabel} areas={["head", "main"]} rows={["auto", "fill"]}>
            <Pane area="head" surface>
                <SlotView
                    slot={props.props.slot}
                    placeholder={props.props.placeholder}
                    labels={props.props.labels}
                    onRetry={props.on.retry}
                    render={(view, isLoading) => (
                        <HeadBand copy={props.props} on={props.on} view={view} isLoading={isLoading} />
                    )}
                />
            </Pane>
            <Pane area="main" surface scroll label={props.props.mainLabel}>
                <PaneBody>
                    <SlotView
                        slot={props.props.slot}
                        placeholder={props.props.placeholder}
                        labels={props.props.labels}
                        onRetry={props.on.retry}
                        render={(view) => <ConnectionRowBody view={view} on={props.on} withAccess />}
                    />
                </PaneBody>
            </Pane>
        </PaneGrid>
    )
}
