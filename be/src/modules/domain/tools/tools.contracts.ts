/**
 * The contracts of the gateway, by concept: a tool and its connector (`gateway-tool`), who calls and what runs a native tool
 * (`gateway-caller`), what the console and the registry read and write (`gateway-console`), and the data rights and the action
 * graph's gate (`gateway-data`). Every importer reads them from here.
 */
export type { ManifestAnswers, ToolCallResult, ToolJson, RefusalClass } from "@modules/domain/tool-receipts"
export type {
    CapabilityRole,
    ToolArgument,
    ToolManifest,
    ManifestTool,
    OptionalToolName,
    RoleReadiness,
    RoleResolution,
    RoleTool,
    ToolScope,
} from "./tool-manifest.contracts"
export type {
    ConversationLeadsGate,
    ToolCaller,
    ToolRun,
    NativeToolFamily,
    NativeCaller,
    ProviderPart,
} from "./tool-caller.contracts"
export type {
    BreakerGate,
    BreakerPhase,
    BreakerState,
    CallLogQuery,
    CallLogView,
    CallOutcome,
    GrantVerdict,
    GrantView,
    ToolGrant,
    WorkspaceToolFamily,
} from "./tool-console.contracts"

