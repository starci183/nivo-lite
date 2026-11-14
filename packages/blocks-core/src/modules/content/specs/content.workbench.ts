import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { viewNodeOf, withAgentDesk, type DeskOfModule } from "../../platform/specs/agent-desk"
import data from "./content.workbench.json"

/** The desk of the Content agent: block 6 lists its posts, counted by this week's plan (`blocks-core.content.api.post.week`), opening the module's list as a page. */
export const CONTENT_DESK: DeskOfModule = {
    dataSets: [{ set: "posts", label: { key: "desk_posts" }, countPath: "planned" }],
    counts: { read: "blocks-core.content.api.post.week" },
    pages: { posts: viewNodeOf(data, "posts-pane") },
}

/** The seed spec of the Content workbench: the agent's desk first, then the posts with this week's figures, a new post and the brand. */
export const CONTENT_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, CONTENT_DESK))
