import { Alert } from "@starci/grammar/common"
import { AgentAutomationsCard } from "@/components/blocks/AgentAutomationsCard"
import { AgentConnectionAccess } from "@/components/blocks/AgentConnectionAccess"
import { AgentIdentityCard } from "@/components/blocks/AgentIdentityCard"
import { AgentLiveCard } from "@/components/blocks/AgentLiveCard"
import { AgentModeCard } from "@/components/blocks/AgentModeCard"
import { AgentReplyCard } from "@/components/blocks/AgentReplyCard"
import { AgentSyncCard } from "@/components/blocks/AgentSyncCard"
import { LoyaltyProgramExtras } from "@/features/module-loyalty/ProgramSettings"
import type { ModuleScope } from "@/lib/automation-shared"
import type { Installation } from "@/modules/installations"
import { COLUMN, GRID } from "./classNames"

/** The facts of the agent the settings cards show; the installation fields are empty while the page loads. */
export interface AgentSettingsPageBaseProps {
    readonly props: {
        readonly isLoading: boolean
        readonly installation: Installation | null
        readonly module: string
        readonly glyph: string
        readonly sharedType: string
        readonly canEdit: boolean
        readonly canGrant: boolean
        readonly connections: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly status: "pending" | "connected" | "error" | "disconnected"
            readonly purpose: string | null
            readonly access: string
        }>
        readonly connectionsHref: string
        readonly automationsHref: string
        readonly automationsScope: ModuleScope | null
        /** The extra card of the module, by its catalogue key; null when it has none. */
        readonly extrasKey: string | null
        readonly timeoutSec: number
        readonly holdingMessage: string
        /** Tells that shifts speaks to staff only through a bound channel; empty when it is bound or not shifts. */
        readonly shiftsNotice: string
    }
}

/** Draws the settings of an agent: its name, mode and live switch, the connections it uses, its automations and sync, and the extra card of its module. */
export const AgentSettingsPageBase = (props: AgentSettingsPageBaseProps) => {
    const { installation, isLoading, canEdit } = props.props
    const installationId = installation?.id ?? ""
    return (
        <div className={GRID}>
            <div className={COLUMN}>
                <AgentIdentityCard
                    installationId={installationId}
                    glyph={props.props.glyph}
                    module={props.props.module}
                    agentName={installation?.agentName ?? ""}
                    handle={installation?.agentHandle ?? ""}
                    instanceName={installation?.name ?? ""}
                    isInstance={installation?.isMulti === true}
                    canEdit={canEdit}
                    isLoading={isLoading}
                />
                <AgentModeCard
                    installationId={installationId}
                    mode={installation?.operatingMode ?? "assist"}
                    sharedType={props.props.sharedType}
                    canEdit={canEdit}
                    isLoading={isLoading}
                />
            </div>
            <div className={COLUMN}>
                <AgentLiveCard
                    installationId={installationId}
                    isLive={installation?.liveEnabled ?? false}
                    hasVersion={installation?.activeContextVersionId != null}
                    canEdit={canEdit}
                    isLoading={isLoading}
                />
                {installation?.agentId ? (
                    <AgentConnectionAccess
                        agentId={installation.agentId}
                        connections={props.props.connections}
                        canEdit={props.props.canGrant}
                        manageHref={props.props.connectionsHref}
                    />
                ) : null}
                {props.props.shiftsNotice === "" ? null : <Alert tone="informative" title={props.props.shiftsNotice} />}
                {installation !== null && canEdit && props.props.automationsScope !== null ? (
                    <AgentAutomationsCard moduleKey={props.props.automationsScope} href={props.props.automationsHref} />
                ) : null}
                {installation !== null && canEdit ? <AgentSyncCard installationId={installation.id} /> : null}
                {installation !== null && canEdit && props.props.extrasKey === "chatbot_reply" ? (
                    <AgentReplyCard
                        installationId={installation.id}
                        timeoutSec={props.props.timeoutSec}
                        holdingMessage={props.props.holdingMessage}
                    />
                ) : null}
                {installation !== null && props.props.extrasKey === "loyalty_program" ? (
                    <LoyaltyProgramExtras installation={installation} canEdit={canEdit} />
                ) : null}
            </div>
        </div>
    )
}
