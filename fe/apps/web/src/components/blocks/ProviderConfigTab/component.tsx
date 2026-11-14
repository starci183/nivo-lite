import { Grid, Stack } from "@starci/grammar/common"
import type { ReactElement, ReactNode } from "react"
import { ConnectionAgents } from "@/components/blocks/ConnectionAgents"
import { CrmReadiness } from "@/components/blocks/CrmReadiness"
import { ConnectionFormCard } from "@/components/blocks/ConnectionFormCard"
import { ConnectionOpenContent } from "@/components/blocks/ConnectionOpenContent"
import { ConnectionOpenEvents } from "@/components/blocks/ConnectionOpenEvents"
import { ConnectionOpenFacts } from "@/components/blocks/ConnectionOpenFacts"
import { DriveConnectionEvents } from "@/components/blocks/DriveConnectionEvents"
import { DriveConnectionFacts } from "@/components/blocks/DriveConnectionFacts"
import { DriveConnectionNotices } from "@/components/blocks/DriveConnectionNotices"
import { DriveConnectionSteps } from "@/components/blocks/DriveConnectionSteps"
import { DriveLedger } from "@/components/blocks/DriveLedger"
import { SepayConnectionSteps } from "@/components/blocks/SepayConnectionSteps"
import { SepayHealth } from "@/components/blocks/SepayHealth"
import { SepayNotices } from "@/components/blocks/SepayNotices"
import { SepayRail } from "@/components/blocks/SepayRail"
import { TelegramConnectionEvents } from "@/components/blocks/TelegramConnectionEvents"
import { TelegramConnectionFacts } from "@/components/blocks/TelegramConnectionFacts"
import { TelegramConnectionNotices } from "@/components/blocks/TelegramConnectionNotices"
import { TelegramConnectionSteps } from "@/components/blocks/TelegramConnectionSteps"
import { ZaloConnectionEvents } from "@/components/blocks/ZaloConnectionEvents"
import { ZaloConnectionFacts } from "@/components/blocks/ZaloConnectionFacts"
import { ZaloConnectionNotices } from "@/components/blocks/ZaloConnectionNotices"
import { ZaloConnectionSteps } from "@/components/blocks/ZaloConnectionSteps"
import { ZaloConnectionZns } from "@/components/blocks/ZaloConnectionZns"
import type { Provider } from "@/modules/types"

/** The account the tab draws and the provider it belongs to (undefined while the connection is read). */
export interface ProviderConfigTabBaseProps {
    readonly props: {
        readonly connectionId: string
        readonly provider: Provider | undefined
    }
}

/** The two columns of the tab: the Connection form card and the account's own content on the left, the live events at the right. */
const columns = (left: ReactNode, events: ReactNode): ReactElement => (
    <Grid
        kind="pair"
        leading={
            <Stack gap="region">
                <ConnectionFormCard />
                {left}
            </Stack>
        }
        trailing={<Stack gap="region">{events}</Stack>}
    />
)

/**
 * The Config tab of the one provider page template. Every provider's account content sits in the left column and its live events
 * in the right one (the switches of its triggers are on the Trigger tab): a SePay, Zalo OA, Telegram or Google Drive account brings its notices, its setup steps and its details (what its own
 * page drew before the template), and a Google (Sheets) account its ledger; any other account brings the row's alerts, notes, SMTP panel and keys, and its details.
 */
export const ProviderConfigTabBase = (props: ProviderConfigTabBaseProps): ReactElement => {
    const { connectionId, provider } = props.props
    switch (provider) {
        case "sepay":
            return columns(
                <>
                    <SepayNotices connectionId={connectionId} />
                    <SepayConnectionSteps connectionId={connectionId} />
                    <SepayHealth connectionId={connectionId} />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <SepayRail connectionId={connectionId} />,
            )
        case "zalo_oa":
            return columns(
                <>
                    <ZaloConnectionNotices connectionId={connectionId} />
                    <ZaloConnectionSteps connectionId={connectionId} />
                    <ZaloConnectionZns connectionId={connectionId} />
                    <ZaloConnectionFacts connectionId={connectionId} />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <ZaloConnectionEvents connectionId={connectionId} />,
            )
        case "telegram":
            return columns(
                <>
                    <TelegramConnectionNotices connectionId={connectionId} />
                    <TelegramConnectionSteps connectionId={connectionId} />
                    <TelegramConnectionFacts connectionId={connectionId} />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <TelegramConnectionEvents connectionId={connectionId} />,
            )
        case "google_drive":
            return columns(
                <>
                    <DriveConnectionNotices />
                    <DriveConnectionSteps />
                    <DriveConnectionFacts />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <DriveConnectionEvents />,
            )
        case "google":
            return columns(
                <>
                    <ConnectionOpenContent />
                    <DriveLedger />
                    <ConnectionOpenFacts />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <ConnectionOpenEvents />,
            )
        case "openapi":
            return columns(
                <>
                    <ConnectionOpenContent />
                    <CrmReadiness connectionId={connectionId} />
                    <ConnectionOpenFacts />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <ConnectionOpenEvents />,
            )
        default:
            return columns(
                <>
                    <ConnectionOpenContent />
                    <ConnectionOpenFacts />
                    <ConnectionAgents connectionId={connectionId} />
                </>,
                <ConnectionOpenEvents />,
            )
    }
}
