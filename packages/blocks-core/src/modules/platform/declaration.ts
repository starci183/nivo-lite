import { defineModule } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { PLATFORM_MODULE_KEY, PLATFORM_VIEW } from "./constants"
import { resumeRunAction } from "./actions/resume-run.action"
import { CHAT_POST_APPROVAL_TOOL, CHAT_POST_REPORT_TOOL } from "./jobs/team-chat.jobs"
import { agentConnectionsRead } from "./reads/agent-connections.read"
import { agentDoneRead } from "./reads/agent-done.read"
import { agentKnowledgeRead } from "./reads/agent-knowledge.read"
import { installationRead } from "./reads/installation.read"
import { parkedRunsRead } from "./reads/parked-runs.read"

/**
 * The platform module: what the back end runs. It reads the installation (`platform.installation`), the agent regions and the runs the engine parked, and has one action, `platform.resume-run`, and no screen: the front end reads it to learn
 * the modules the workspace has enabled and the hash of the registry, and shows "reload" when its own build differs.
 */
export const platformModule: ModuleDeclaration = defineModule({
    key: PLATFORM_MODULE_KEY,
    namespace: PLATFORM_MODULE_KEY,
    permissions: [PLATFORM_VIEW],
    reads: [installationRead, agentDoneRead, agentConnectionsRead, agentKnowledgeRead, parkedRunsRead],
    actions: [resumeRunAction],
    tools: [CHAT_POST_REPORT_TOOL, CHAT_POST_APPROVAL_TOOL],
    specs: [],
})
