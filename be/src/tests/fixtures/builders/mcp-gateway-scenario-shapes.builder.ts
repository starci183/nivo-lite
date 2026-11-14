import type {
    ToolCaller,
    ToolJson,
    CapabilityRole,
    ToolsError,
    RoleReadiness,
} from "@modules/domain/tools"
import type { GatewaySpecSetup } from "./mcp-gateway.builder"

/** The missing write identities record the builders hand out and the specs expect. */
export type MissingWriteIdentitiesShape = {
    readonly label: string
    readonly caller: ToolCaller
    readonly native: boolean
}
/** The timed out writes record the builders hand out and the specs expect. */
export type TimedOutWritesShape = {
    readonly label: string
    readonly tool: string
    readonly args: ToolJson
    readonly attempts: number
}
/** The gateway scenario expected failed read context record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedFailedReadContextShape = { workspaceId: string; connector: string; tool: string }
/** The gateway scenario expected revealed audit record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedRevealedAuditShape = { outcome: string; errorCode: null; resultSummary: string }
/** The gateway scenario expected reveal request args record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedRevealRequestArgsShape = { stayId: string }
/** The gateway scenario expected reveal request record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedRevealRequestShape = {
    name: string
    args: GatewayScenarioExpectedRevealRequestArgsShape
}
/** The gateway scenario expected confirmation constraints record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedConfirmationConstraintsShape = { arg: string; max: number }
/** The gateway scenario expected confirmation input schema record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedConfirmationInputSchemaShape = { type: string }
/** The gateway scenario expected confirmation record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedConfirmationShape = {
    name: string
    description: string
    scope: string
    mode: string
    inputSchema: GatewayScenarioExpectedConfirmationInputSchemaShape
    constraints: Array<GatewayScenarioExpectedConfirmationConstraintsShape>
    limitVnd: null
}
/** The gateway scenario expected missing receivable role record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedMissingReceivableRoleShape = { ok: boolean; code: string; role: string }
/** The gateway scenario expected identity role tool record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedIdentityRoleToolShape = {
    role: string
    name: string
    connector: string
    connectorName: string
}
/** The gateway scenario expected identity role record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedIdentityRoleShape = {
    ok: boolean
    tool: GatewayScenarioExpectedIdentityRoleToolShape
}
/** The gateway scenario expected credits role tool record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedCreditsRoleToolShape = {
    role: string
    name: string
    connector: string
    connectorName: string
}
/** The gateway scenario expected credits role record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedCreditsRoleShape = { ok: boolean; tool: GatewayScenarioExpectedCreditsRoleToolShape }
/** The gateway scenario expected grants constraints record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedGrantsConstraintsShape = { arg: string; max: number }
/** The gateway scenario expected grants record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedGrantsShape = {
    tool: string
    mode: string
    limitVnd: null
    constraints: Array<GatewayScenarioExpectedGrantsConstraintsShape>
}
/** The gateway scenario expected unknown write outcome record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedUnknownWriteOutcomeShape = { ok: boolean; code: string; detail: string }
/** The gateway scenario expected retried answers value record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedRetriedAnswersValueShape = { holdId: string; code: string }
/** The gateway scenario expected retried answers record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedRetriedAnswersShape = {
    ok: boolean
    value: GatewayScenarioExpectedRetriedAnswersValueShape
}
/** The gateway scenario expected ask mode refusal record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedAskModeRefusalShape = { ok: boolean; code: string; reason: string }
/** The gateway scenario expected ready roles record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedReadyRolesShape = {
    ready: boolean
    missing: Array<never>
    providers: Readonly<Record<CapabilityRole, ReadonlyArray<string>>>
}
/** The gateway scenario expected circuit open record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedCircuitOpenShape = { ok: boolean; code: string; detail: string }
/** The gateway scenario expected read failure record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedReadFailureShape = { ok: boolean; code: string; detail: string }
/** The gateway scenario expected read timeout record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedReadTimeoutShape = { ok: boolean; code: string; detail: string }
/** The gateway scenario expected tool refusal record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedToolRefusalShape = { ok: boolean; code: string; detail: string; nativeRefusal: string }
/** The gateway scenario expected native value record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedNativeValueShape = { transactions: Array<never> }
/** The gateway scenario expected native record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedNativeShape = { ok: boolean; value: GatewayScenarioExpectedNativeValueShape }
/** The gateway scenario expected held value record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedHeldValueShape = { holdId: string }
/** The gateway scenario expected held record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedHeldShape = { ok: boolean; value: GatewayScenarioExpectedHeldValueShape }
/** The gateway scenario expected reply value record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedReplyValueShape = { holdId: string; code: string }
/** The gateway scenario expected reply record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedReplyShape = { ok: boolean; value: GatewayScenarioExpectedReplyValueShape }
/** The gateway scenario expected invalid arguments record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedInvalidArgumentsShape = { ok: boolean; code: string; detail: string }
/** The gateway scenario expected record the builders hand out and the specs expect. */
export type GatewayScenarioExpectedShape = {
    nativeUnknownTool: ToolsError
    invalidArguments: GatewayScenarioExpectedInvalidArgumentsShape
    connectorStates: Array<Array<string | number>>
    reply: GatewayScenarioExpectedReplyShape
    held: GatewayScenarioExpectedHeldShape
    native: GatewayScenarioExpectedNativeShape
    toolRefusal: GatewayScenarioExpectedToolRefusalShape
    readTimeout: GatewayScenarioExpectedReadTimeoutShape
    readFailure: GatewayScenarioExpectedReadFailureShape
    circuitOpen: GatewayScenarioExpectedCircuitOpenShape
    readyRoles: GatewayScenarioExpectedReadyRolesShape
    askModeRefusal: GatewayScenarioExpectedAskModeRefusalShape
    approvalOutcomes: Array<Array<string>>
    retriedAnswers: Array<GatewayScenarioExpectedRetriedAnswersShape>
    failedReadOutcomes: Array<Array<string>>
    unknownWriteOutcomes: Array<Array<string>>
    unknownWriteOutcome: GatewayScenarioExpectedUnknownWriteOutcomeShape
    grants: Array<GatewayScenarioExpectedGrantsShape>
    creditsRole: GatewayScenarioExpectedCreditsRoleShape
    identityRole: GatewayScenarioExpectedIdentityRoleShape
    missingReceivableRole: GatewayScenarioExpectedMissingReceivableRoleShape
    confirmation: GatewayScenarioExpectedConfirmationShape
    revealRequest: GatewayScenarioExpectedRevealRequestShape
    revealedAudit: GatewayScenarioExpectedRevealedAuditShape
    failedReadContext: GatewayScenarioExpectedFailedReadContextShape
}
/** The gateway role resolutions record the builders hand out and the specs expect. */
export type GatewayRoleResolutionsShape = { readonly role: CapabilityRole; readonly answer: unknown }
/** The gateway readiness record the builders hand out and the specs expect. */
export type GatewayReadinessShape = {
    readonly label: string
    readonly roles: ReadonlyArray<CapabilityRole>
    readonly answer: RoleReadiness
}
/** The invalid gateway tools answer record the builders hand out and the specs expect. */
export type InvalidGatewayToolsAnswerShape = { ok: boolean; code: string; detail: string }
/** The invalid gateway tools record the builders hand out and the specs expect. */
export type InvalidGatewayToolsShape = { name: string; answer: InvalidGatewayToolsAnswerShape }
/** The invalid gateway arguments record the builders hand out and the specs expect. */
export type InvalidGatewayArgumentsShape = {
    readonly label: string
    readonly setup: GatewaySpecSetup
    readonly tool: string
    readonly args: ToolJson
    readonly audit: ReadonlyArray<ReadonlyArray<string>>
}
