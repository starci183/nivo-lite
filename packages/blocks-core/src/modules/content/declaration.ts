import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { approvePostAction, markPublishedAction, saveBrandAction, savePostAction } from "./actions/content.actions"
import { CONTENT_PERMISSIONS } from "./constants"
import { brandRead, postRead, postsRead, weekRead } from "./reads/content.reads"
import { CONTENT_WORKBENCH_SPEC } from "./specs/content.workbench"

/** The module key of Content: every read and action id starts with it. */
export const CONTENT_MODULE_KEY = "content"

/**
 * The Content module: the posts of the plan (by state, one post with its words, this week's figures), the brand (voice, limits,
 * themes, rhythm), and the actions that write a post by hand, approve it, mark it published and save the brand. Its graphs plan,
 * write and report over the same two record types through the record tools.
 */
export const contentModule: ModuleDeclaration = defineModule({
    key: CONTENT_MODULE_KEY,
    namespace: CONTENT_MODULE_KEY,
    agent: {
        tools: [TOOL.teamMessagePost],
    },
    permissions: CONTENT_PERMISSIONS,
    reads: [postsRead, postRead, brandRead, weekRead],
    actions: [saveBrandAction, savePostAction, approvePostAction, markPublishedAction],
    specs: [CONTENT_WORKBENCH_SPEC],
})
