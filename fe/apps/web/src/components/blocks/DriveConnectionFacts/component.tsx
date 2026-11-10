import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CONNECTION_FACTS_PLACEHOLDER, ConnectionFactsCard } from "@/components/composites/ConnectionFactsCard"
import { ConnectionSetupCard } from "@/components/composites/ConnectionSetupCard"
import { GoogleServicesCard } from "@/components/composites/GoogleServicesCard"
import type { GoogleServiceRow } from "@/components/composites/GoogleServicesCard"
import type { ConnectionFactView, DataSlot, SlotLabels } from "@/modules/types"

/** The setup card while the grant is missing or waits for its first sync. */
interface DriveSetupView {
    readonly title: string
    readonly phases: ReadonlyArray<string>
    readonly current: number
    readonly stateLabels: { readonly complete: string; readonly current: string; readonly upcoming: string }
    readonly next: {
        readonly title: string
        readonly body: string
        readonly action?: { readonly label: string; readonly href: string }
    }
}

/** The words, the reads and the retry of the overview of the Google account. */
export interface DriveConnectionFactsBaseProps {
    readonly props: {
        readonly title: string
        readonly servicesTitle: string
        readonly servicesHint: string
        readonly services: ReadonlyArray<GoogleServiceRow>
        readonly facts: DataSlot<ReadonlyArray<ConnectionFactView>>
        readonly slotLabels: SlotLabels
        /** Present while the setup is unfinished. */
        readonly setup?: DriveSetupView
    }
    readonly on: { readonly retry: () => void }
}

/**
 * Draws the overview regions of the Google account: while Drive has no grant or waits for its first sync, the four phases with the
 * one step left; then the services of the account (Drive, Sheets, and the ones coming); then the connection's facts (account,
 * permissions given, documents read, last read, allowance) as term and value rows.
 */
export const DriveConnectionFactsBase = (props: DriveConnectionFactsBaseProps) => {
    const setup = props.props.setup
    return (
        <>
            {setup === undefined ? null : (
                <ConnectionSetupCard
                    title={setup.title}
                    phases={setup.phases}
                    current={setup.current}
                    stateLabels={setup.stateLabels}
                    next={setup.next}
                />
            )}
            <GoogleServicesCard
                title={props.props.servicesTitle}
                hint={props.props.servicesHint}
                services={props.props.services}
            />
            <SlotView
                slot={props.props.facts}
                placeholder={CONNECTION_FACTS_PLACEHOLDER}
                labels={props.props.slotLabels}
                onRetry={props.on.retry}
                render={(facts, isLoading) => (
                    <ConnectionFactsCard title={props.props.title} facts={facts} isLoading={isLoading} />
                )}
            />
        </>
    )
}
