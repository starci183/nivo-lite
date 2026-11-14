/** Log events of the tools registry. */
export enum ToolsLogEvent {
    /** A connector call failed or timed out; the caller got `unavailable`. */
    CallFailed = "tools.call.failed",
    /** A graph node's tool call was refused or failed at the node door: the typed code, the gateway code and the reason, never the arguments. */
    NodeToolFailed = "tools.node-tool.failed",
    /** A write of a step that ran again was answered from its earlier attempt's receipt at the same position (not made again). */
    ReceiptAnswered = "tools.node-tool.receipt-answered",
    /** The shadow compare: a node's policy would have decided another code than the agent-level rights did (ids and codes only). */
    NodePolicyShadowDiffers = "tools.node-policy-shadow.differs",
    /** The shadow compare failed (its store, its read); the failure is swallowed, counted and logged once in every hundred. */
    NodePolicyShadowFailed = "tools.node-policy-shadow.failed",
    /** The reverse shadow, with a workspace's node rights switched on: the agent's tick would have decided another code than the node did (ids and codes only). */
    NodeRightsTickWouldDiffer = "tools.node-rights.tick-would-differ",
    /** A workspace's switch "node rights decide" reads ON and this process cannot decide by node (no grant rows or no reader of the workflow versions bound): the agent's ticks still decide here. Logged once per process. */
    NodeRightsSwitchIneffective = "tools.node-rights.switch-ineffective",
    /** After agents were attached to an account by their template, bringing an agent its node rows failed; the attachment is stored and the rows wait for the owner. */
    NodeRightRowsFailed = "tools.node-rights.rows-failed",
    /** The audit line of an effect's rights verdict could not be written; the verdict stands and is acted on. */
    EffectRightAuditFailed = "tools.effect-right.audit-failed",
}
