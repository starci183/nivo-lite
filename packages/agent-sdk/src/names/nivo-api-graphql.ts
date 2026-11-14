import { NIVO_API, type NivoApiVerb } from "./api"

/** One GraphQL operation of the app's contract: the kind of root it sits on and its field name there. */
export interface GraphqlOperation {
    /** The root the field sits on: a `query` reads, a `mutation` changes. */
    readonly kind: "query" | "mutation"
    /** The name of the field on that root, as `schema.graphql` writes it. */
    readonly operation: string
}

/**
 * The ONE mapping from every NIVO-owned API name (`nivo.api.nivo.<object>.<op>`, `NIVO_API`) to the GraphQL operation of the app's contract
 * (`be/contracts/api/schema.graphql`) that serves it. A person's screen calls the GraphQL operation; a workbench (and the outbound MCP
 * surface, generated from the API declarations) calls the API name; both reach the same operation, so rights and audit are the same. The
 * mapping is declared data because the names do not derive from each other (`file.get` ↔ `fileUrl`, `contact.list` ↔ `contacts`). It is
 * TOTAL over `NivoApiVerb` by its type: a new API name without a row does not compile. The project check `nivo-api-graphql` keeps the table
 * and the contract equal: a row names a field of the right kind, and no two API names share one field.
 */
export type NivoApiGraphql = { readonly [V in NivoApiVerb]: GraphqlOperation }

export const NIVO_API_GRAPHQL: NivoApiGraphql = {
    [NIVO_API.file.upload]: { kind: "mutation", operation: "fileUpload" },
    [NIVO_API.file.confirm]: { kind: "mutation", operation: "fileConfirm" },
    [NIVO_API.file.link]: { kind: "mutation", operation: "fileLink" },
    [NIVO_API.file.get]: { kind: "query", operation: "fileUrl" },
    [NIVO_API.file.delete]: { kind: "mutation", operation: "fileDelete" },
    [NIVO_API.contact.list]: { kind: "query", operation: "contacts" },
    [NIVO_API.contact.get]: { kind: "query", operation: "contact" },
    [NIVO_API.contact.blockList]: { kind: "query", operation: "contactModuleBlocks" },
    [NIVO_API.contact.update]: { kind: "mutation", operation: "updateContact" },
    [NIVO_API.contact.identityLink]: { kind: "mutation", operation: "linkContactIdentity" },
    [NIVO_API.contact.identityUnlink]: { kind: "mutation", operation: "unlinkContactIdentity" },
    [NIVO_API.contact.merge]: { kind: "mutation", operation: "mergeContacts" },
    [NIVO_API.contact.memoryForget]: { kind: "mutation", operation: "forgetContactMemory" },
    [NIVO_API.contact.delete]: { kind: "mutation", operation: "deleteContact" },
    [NIVO_API.customerMessage.list]: { kind: "query", operation: "customerMessages" },
    [NIVO_API.chatThread.list]: { kind: "query", operation: "chatRooms" },
    [NIVO_API.chatThread.get]: { kind: "query", operation: "chatMessages" },
    [NIVO_API.brain.search]: { kind: "query", operation: "brainGraph" },
    [NIVO_API.workbench.read]: { kind: "query", operation: "workbenchRead" },
    [NIVO_API.workbench.action]: { kind: "mutation", operation: "workbenchAction" },
    [NIVO_API.record.typeList]: { kind: "query", operation: "recordTypes" },
    [NIVO_API.accountData.typeList]: { kind: "query", operation: "accountDataTypes" },
    [NIVO_API.accountData.rowList]: { kind: "query", operation: "accountDataRows" },
    [NIVO_API.agent.list]: { kind: "query", operation: "moduleInstallations" },
    [NIVO_API.agent.toolList]: { kind: "query", operation: "agentTools" },
    [NIVO_API.agent.deletionImpact]: { kind: "query", operation: "agentDeletionImpact" },
    [NIVO_API.workflow.list]: { kind: "query", operation: "agentWorkflows" },
    [NIVO_API.workflow.get]: { kind: "query", operation: "runnableWorkflow" },
    [NIVO_API.workflow.run]: { kind: "mutation", operation: "runWorkflow" },
    [NIVO_API.run.list]: { kind: "query", operation: "agentRuns" },
    [NIVO_API.run.get]: { kind: "query", operation: "agentRun" },
    [NIVO_API.run.stepDecide]: { kind: "mutation", operation: "decideAgentRunStep" },
    [NIVO_API.stop.list]: { kind: "query", operation: "runStops" },
    [NIVO_API.stop.answer]: { kind: "mutation", operation: "decideRunStop" },
    [NIVO_API.key.list]: { kind: "query", operation: "apiKeys" },
    [NIVO_API.key.create]: { kind: "mutation", operation: "createApiKey" },
    [NIVO_API.key.rename]: { kind: "mutation", operation: "renameApiKey" },
    [NIVO_API.key.revoke]: { kind: "mutation", operation: "revokeApiKey" },
    [NIVO_API.member.roleChange]: { kind: "mutation", operation: "changeMemberRole" },
    [NIVO_API.member.remove]: { kind: "mutation", operation: "removeMember" },
    [NIVO_API.workspace.delete]: { kind: "mutation", operation: "deleteWorkspace" },
    [NIVO_API.theme.get]: { kind: "query", operation: "workspaceTheme" },
    [NIVO_API.theme.update]: { kind: "mutation", operation: "updateWorkspaceTheme" },
    [NIVO_API.theme.reset]: { kind: "mutation", operation: "resetWorkspaceTheme" },
    [NIVO_API.connection.zaloOaSecretSave]: { kind: "mutation", operation: "saveZaloOaSecret" },
    [NIVO_API.admin.workspacePlanSet]: { kind: "mutation", operation: "adminSetWorkspacePlan" },
}
