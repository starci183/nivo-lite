import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { addCandidateAction, saveJobAction, updateCandidateAction } from "./actions/hiring.actions"
import { HIRING_PERMISSIONS } from "./constants"
import { HIRING_CONTACT_BLOCKS } from "./contact-blocks"
import { CONTACT_CANDIDATES } from "./reads/contact-candidates.read"
import { candidateRead, candidatesRead, jobRead, jobsRead } from "./reads/hiring.read"
import { HIRING_WORKBENCH_SPEC } from "./specs/hiring.workbench"

/** The module key of Hiring: every read and action id starts with it. */
export const HIRING_MODULE_KEY = "hiring"

/**
 * The Hiring module: the candidates by stage, the jobs, one candidate or one job with its forms; and the actions that change them,
 * over the generic records `blocks-core.hiring.job` and `blocks-core.hiring.candidate`. The seed spec draws it from the generic blocks.
 */
export const hiringModule: ModuleDeclaration = defineModule({
    key: HIRING_MODULE_KEY,
    namespace: "hiring",
    agent: {
        tools: [TOOL.mailMessageSend, TOOL.teamMessagePost],
    },
    permissions: HIRING_PERMISSIONS,
    reads: [jobsRead, jobRead, candidatesRead, CONTACT_CANDIDATES, candidateRead],
    actions: [saveJobAction, addCandidateAction, updateCandidateAction],
    contactBlocks: HIRING_CONTACT_BLOCKS,
    specs: [HIRING_WORKBENCH_SPEC],
})
