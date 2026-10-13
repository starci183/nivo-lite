import type { ModuleDefinition, ModulesCatalog } from "@modules/domain/modules"
import type { InstallResult, SetupState, SetupVersions } from "@modules/domain/modules"
import type { AgentSyncStatus, InstallationRecord, RequirementFacts } from "@modules/domain/module-installations"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import type { CardRecord } from "@modules/domain/module-setup-writes"
import type { Locale } from "@modules/platform/i18n"
import type { ApplySetupRequest } from "../../application/apply-setup.contracts"
import type { DecideSetupCardRequest } from "../../application/decide-setup-card.contracts"
import type { GetAgentSyncStatusRequest } from "../../application/get-agent-sync-status.contracts"
import type { GetCatalogRequest } from "../../application/get-catalog.contracts"
import type { GetInstallationRequest } from "../../application/get-installation.contracts"
import type { GetModuleRequest } from "../../application/get-module.contracts"
import type { GetRequirementFactsRequest } from "../../application/get-requirement-facts.contracts"
import type { GetSetupStateRequest } from "../../application/get-setup-state.contracts"
import type { InstallModuleRequest } from "../../application/install-module.contracts"
import type { ListInstallationsRequest } from "../../application/list-installations.contracts"
import type { ListSetupVersionsRequest } from "../../application/list-setup-versions.contracts"
import type { PostSetupMessageRequest } from "../../application/post-setup-message.contracts"
import type { RenameInstallationAgentRequest } from "../../application/rename-installation-agent.contracts"
import type { RenameInstallationRequest } from "../../application/rename-installation.contracts"
import type { SaveInstallationSettingRequest } from "../../application/save-installation-setting.contracts"
import type { SetModuleLiveRequest } from "../../application/set-module-live.contracts"
import type { SetOperatingModeRequest } from "../../application/set-operating-mode.contracts"
import type { SetSetupGateRequest } from "../../application/set-setup-gate.contracts"
import type { AgentSyncStatusType } from "./dto/agent-sync-status.type"
import type { DecideSetupCardInput } from "./dto/decide-setup-card.input"
import type { InstallModuleInput } from "./dto/install-module.input"
import type { ModuleDefinitionType } from "./dto/module-definition.type"
import type { ModuleInstallResultType } from "./dto/module-install-result.type"
import type { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import type { ModuleInstallationType } from "./dto/module-installation.type"
import type { ModuleKeyInput } from "./dto/module-key.input"
import type { ModuleRequirementFactsType } from "./dto/module-requirement-facts.type"
import type { ModulesCatalogType } from "./dto/modules-catalog.type"
import type { PostSetupMessageInput } from "./dto/post-setup-message.input"
import type { RenameInstallationAgentInput } from "./dto/rename-installation-agent.input"
import type { RenameModuleInstallationInput } from "./dto/rename-module-installation.input"
import type { SaveHoldingMessageInput } from "./dto/save-holding-message.input"
import type { SaveReplyTimeoutInput } from "./dto/save-reply-timeout.input"
import type { SetModuleLiveInput } from "./dto/set-module-live.input"
import type { SetOperatingModeInput } from "./dto/set-operating-mode.input"
import type { SetSetupGateInput } from "./dto/set-setup-gate.input"
import type { SetupApplyResultType } from "./dto/setup-apply-result.type"
import type { SetupCardType } from "./dto/setup-card.type"
import type { SetupMessageType } from "./dto/setup-message.type"
import type { SetupSessionType } from "./dto/setup-session.type"
import type { SetupStateType } from "./dto/setup-state.type"
import type { SetupVersionsType } from "./dto/setup-versions.type"

/** The catalogue request: it takes no input. */
export const toCatalogRequest = (): GetCatalogRequest => ({})

/** Maps one module definition to the GraphQL type. */
export const toModuleDefinitionType = (module: ModuleDefinition): ModuleDefinitionType => ({ ...module })

/** Maps the key of the GraphQL input to the query request. */
export const toGetModuleRequest = (input: ModuleKeyInput): GetModuleRequest => ({ ...input })

/** Maps the catalogue to the GraphQL type. */
export const toModulesCatalogType = (catalog: ModulesCatalog): ModulesCatalogType => ({ ...catalog })

/** Maps the workspace of the request to the listing request. */
export const toListInstallationsRequest = (workspaceId: string): ListInstallationsRequest => ({ workspaceId })

/** Maps one installed agent to the GraphQL type. */
export const toModuleInstallationType = (record: InstallationRecord): ModuleInstallationType => ({ ...record })

/** Maps the installation of the GraphQL input, with the workspace it names, to the query request. */
export const toGetInstallationRequest = (
    workspaceId: string,
    input: ModuleInstallationIdInput,
): GetInstallationRequest => ({ workspaceId, ...input })

/** Maps the installed agents to the GraphQL type. */
export const toModuleInstallationsType = (records: ReadonlyArray<InstallationRecord>): Array<ModuleInstallationType> =>
    records.map((record) => ({ ...record }))

/** Maps the installation of the GraphQL input, with the workspace it names, to the sync status request. */
export const toGetAgentSyncStatusRequest = (
    workspaceId: string,
    input: ModuleInstallationIdInput,
): GetAgentSyncStatusRequest => ({ workspaceId, ...input })

/** Maps what installing answered to the GraphQL type. */
export const toModuleInstallResultType = (result: InstallResult): ModuleInstallResultType => ({ ...result })

/** Maps the install input, with the workspace and the locale, to the command request. */
export const toInstallModuleRequest = (
    workspaceId: string,
    input: InstallModuleInput,
    locale: Locale,
): InstallModuleRequest => ({ workspaceId, locale, ...input })

/** Maps the sync status of an agent to the GraphQL type. */
export const toAgentSyncStatusType = (status: AgentSyncStatus): AgentSyncStatusType => ({ ...status })

/** Maps the rename of the GraphQL input, with the workspace it names, to the command request. */
export const toRenameInstallationRequest = (
    workspaceId: string,
    input: RenameModuleInstallationInput,
): RenameInstallationRequest => ({ workspaceId, ...input })

/** Maps the setup state to the GraphQL type. */
export const toSetupStateType = (state: SetupState): SetupStateType => ({ ...state })

/** Maps the agent rename of the GraphQL input, with the workspace it names, to the command request. */
export const toRenameInstallationAgentRequest = (
    workspaceId: string,
    input: RenameInstallationAgentInput,
): RenameInstallationAgentRequest => ({ workspaceId, ...input })

/** Maps the context versions to the GraphQL type. */
export const toSetupVersionsType = (versions: SetupVersions): SetupVersionsType => ({ ...versions })

/** Maps the operating mode of the GraphQL input, with the workspace it names, to the command request. */
export const toSetOperatingModeRequest = (
    workspaceId: string,
    input: SetOperatingModeInput,
): SetOperatingModeRequest => ({
    workspaceId,
    ...input,
})

/** Maps a stored chat message to the GraphQL type. */
export const toSetupMessageType = (message: SetupMessageRecord): SetupMessageType => ({ ...message })

/** Maps the live switch of the GraphQL input, with the workspace it names, to the command request. */
export const toSetModuleLiveRequest = (workspaceId: string, input: SetModuleLiveInput): SetModuleLiveRequest => ({
    workspaceId,
    ...input,
})

/** Maps a setup session to the GraphQL type. */
export const toSetupSessionType = (session: SetupSessionRecord): SetupSessionType => ({ ...session })

/** Maps the reply timeout of the GraphQL input, with the workspace it names, to the setting command request. */
export const toSaveReplyTimeoutRequest = (
    workspaceId: string,
    input: SaveReplyTimeoutInput,
): SaveInstallationSettingRequest => ({
    workspaceId,
    installationId: input.installationId,
    name: "openclawTimeoutSec",
    value: input.value,
})

/** Maps the number of an applied version to the GraphQL type. */
export const toSetupApplyResultType = (version: number): SetupApplyResultType => ({ version })

/** Maps the holding message of the GraphQL input, with the workspace it names, to the setting command request. */
export const toSaveHoldingMessageRequest = (
    workspaceId: string,
    input: SaveHoldingMessageInput,
): SaveInstallationSettingRequest => ({
    workspaceId,
    installationId: input.installationId,
    name: "holdingMessage",
    value: input.value,
})

/** Maps a decided confirm card to the GraphQL type. */
export const toSetupCardType = (card: CardRecord): SetupCardType => ({ ...card })

/** Maps the installation of the GraphQL input, with the workspace and the locale, to the setup state request. */
export const toGetSetupStateRequest = (
    workspaceId: string,
    input: ModuleInstallationIdInput,
    locale: Locale,
): GetSetupStateRequest => ({ workspaceId, locale, ...input })

/** Maps the installation of the GraphQL input, with the workspace it names, to the versions request. */
export const toListSetupVersionsRequest = (
    workspaceId: string,
    input: ModuleInstallationIdInput,
): ListSetupVersionsRequest => ({ workspaceId, ...input })

/** Maps the message of the GraphQL input, with the workspace and the locale, to the command request. */
export const toPostSetupMessageRequest = (
    workspaceId: string,
    input: PostSetupMessageInput,
    locale: Locale,
): PostSetupMessageRequest => ({ workspaceId, locale, ...input })

/** Maps the gate change of the GraphQL input, with the workspace it names, to the command request. */
export const toSetSetupGateRequest = (workspaceId: string, input: SetSetupGateInput): SetSetupGateRequest => ({
    workspaceId,
    ...input,
})

/** Maps the installation of the GraphQL input, with the workspace and the locale, to the apply request. */
export const toApplySetupRequest = (
    workspaceId: string,
    input: ModuleInstallationIdInput,
    locale: Locale,
): ApplySetupRequest => ({ workspaceId, locale, ...input })

/** Maps the card decision of the GraphQL input, with the workspace and the locale, to the command request. */
export const toDecideSetupCardRequest = (
    workspaceId: string,
    input: DecideSetupCardInput,
    locale: Locale,
): DecideSetupCardRequest => ({ workspaceId, locale, ...input })

/** Maps the workspace of the request to the requirement facts request. */
export const toGetRequirementFactsRequest = (workspaceId: string): GetRequirementFactsRequest => ({ workspaceId })

/** Maps the requirement facts of a workspace to the GraphQL type. */
export const toModuleRequirementFactsType = (facts: RequirementFacts): ModuleRequirementFactsType => ({ ...facts })
