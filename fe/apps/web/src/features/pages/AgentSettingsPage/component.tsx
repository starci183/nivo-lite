import { Stack, SurfaceCard } from "@starci/grammar/common"
import type { ModuleIconName } from "@/modules/types"
import { AgentAutomations } from "@/components/blocks/AgentAutomations"
import { AgentConnectionAccess } from "@/components/blocks/AgentConnectionAccess"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentLiveCard } from "@/components/blocks/AgentLiveCard"
import { AgentModeCard } from "@/components/blocks/AgentModeCard"
import { AgentWorkSwitchCard } from "@/components/blocks/AgentWorkSwitchCard"
import { AgentRemoveCard } from "@/components/blocks/AgentRemoveCard"
import { AgentReplyCard } from "@/components/blocks/AgentReplyCard"
import { AgentSyncCard } from "@/components/blocks/AgentSyncCard"
import type { ModuleKey } from "@/modules/catalog"

/** The facts of the type and the instance the settings cards read. */
export interface AgentSettingsPageBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly installationId: string
        readonly glyph: ModuleIconName
        /** The extra card of the type, by its catalogue key; null when it has none. */
        readonly extrasKey: string | null
        /** The heading of the card that groups the work switch, the reply switch and the operating mode. */
        readonly activityTitle: string
        /** False for an internal agent (Sales, Accounting): the switch that lets it answer customers is left out. */
        readonly answersCustomers: boolean
    }
}

/**
 * Draws the settings of an agent as one narrow column of cards grouped by what the owner is doing: its name and picture; its
 * activity (whether it works, whether it answers customers and its operating mode as three bands of one card); the connections it
 * uses; its automations; the extra card of its type; its copy; and removing it as the last row.
 */
export const AgentSettingsPageBase = (props: AgentSettingsPageBaseProps) => {
    const { module, installationId } = props.props
    return (
        <Stack gap="region" measure="form">
            <AgentIdentityCard installationId={installationId} module={module} glyph={props.props.glyph} />
            <SurfaceCard
                kind="bands"
                label={props.props.activityTitle}
                headingLevel={2}
                bands={[
                    { kind: "body", children: <AgentWorkSwitchCard installationId={installationId} /> },
                    ...(props.props.answersCustomers
                        ? [
                              {
                                  kind: "body" as const,
                                  children: <AgentLiveCard installationId={installationId} module={module} />,
                              },
                          ]
                        : []),
                    { kind: "body", children: <AgentModeCard installationId={installationId} module={module} /> },
                ]}
            />
            <AgentConnectionAccess installationId={installationId} module={module} />
            {props.props.extrasKey === "chatbot_reply" ? (
                <AgentReplyCard installationId={installationId} module={module} />
            ) : null}
            <AgentAutomations />
            <AgentSyncCard installationId={installationId} />
            <AgentRemoveCard installationId={installationId} module={module} />
        </Stack>
    )
}
