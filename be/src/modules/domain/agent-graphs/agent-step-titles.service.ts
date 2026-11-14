import { Injectable } from "@nestjs/common"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { installedStepIn } from "@modules/domain/installed-plugins"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import type { OptionalStepTitle } from "./agent-workflow-rights.contracts"

@Injectable()
/**
 * The title of a workflow step in the owner's two languages, read where a step's title is DECLARED: the installed step the step runs
 * (`installedStepIn`: a template node, or a `defineNode` control node, of the core package or of any plugin), the same source the graph
 * editor's cards take their title from.
 * A title a definition gives as a message key is read from the catalogue in each language. Nothing here derives a title from a key
 * or an id: a step no installed node is has no title.
 */
export class AgentStepTitlesService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly nodes: GraphNodeRegistryService,
    ) {}

    /** The title of the step of this id (`chatbot.answer`, `webrenew.find`), or null when no installed node has the id. */
    titleOf(step: string): OptionalStepTitle {
        const title = installedStepIn(this.nodes.installed().nodes, step)?.title
        if (title === undefined) return null
        if ("key" in title) {
            return { vi: this.catalog.get(title.key, {}, "vi"), en: this.catalog.get(title.key, {}, "en") }
        }
        return { vi: title.vi, en: title.en }
    }
}
