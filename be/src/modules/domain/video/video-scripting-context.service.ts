import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService, factLine } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { ScriptProject } from "./video-stored.contracts"
import { readScriptBase, readScriptSetup } from "./persistence/video-scripting.query"
import { videoScriptSetupText } from "./video-scripting-context.policy"
import { VIDEO_SCRIPT_GOALS } from "./video-scripting.templates"
import { videoInputsOf } from "./video-workbench.policy"

@Injectable()
/** Preserves approved video instructions and public knowledge without provider work in the queue-request path. */
export class VideoScriptingContextService {
    constructor(
        private readonly facts: BrainFactsService,
        private readonly authority: AuthorityService,
        private readonly knowledge: KnowledgeSearchService,
    ) {}

    /** A bounded system-context snapshot for one script request; every dynamic business lookup uses the customer lens. */
    async forProject(
        tx: EntityManager,
        workspaceId: string,
        project: ScriptProject,
        selectedSources: string,
    ): Promise<string> {
        const goal = VIDEO_SCRIPT_GOALS[project.goal] ?? VIDEO_SCRIPT_GOALS.custom
        const query = [
            goal.label.vi,
            videoInputsOf(project.inputs, workspaceId).notes,
            selectedSources.slice(0, 300),
        ].join(" ")
        const [snapshots, base, facts, passages, authority] = await Promise.all([
            readScriptSetup(tx, workspaceId),
            readScriptBase(tx),
            this.facts.search(workspaceId, "customer", "video", null, query, 6),
            this.knowledge.passagesText(
                { workspaceId, module: "video", audience: "customer", installationId: null },
                query,
                6,
            ),
            this.authority.load({ workspaceId }),
        ])
        const rules = base
            .map((row) => `## ${row.title}\n${row.body.slice(0, 900)}`)
            .join("\n\n")
            .slice(0, 5200)
        const setup = videoScriptSetupText(snapshots[0]?.snapshot)
        const house = [authority?.brand_voice, authority?.reply_style, authority?.limits_note]
            .filter((value): value is string => typeof value === "string" && value !== "")
            .join("\n")
            .slice(0, 1500)
        const documents = passages
            .filter((passage) => passage.visibility === "public")
            .map((passage) => `- ${passage.title}: ${passage.content.slice(0, 600)}`)
            .join("\n")
            .slice(0, 3000)
        return [
            rules === "" ? "" : `NIVO BASE RULES:\n${rules}`,
            setup === "" ? "" : `APPROVED VIDEO CONFIGURATION:\n${setup}`,
            house === "" ? "" : `HOUSE VOICE AND CLAIM LIMITS:\n${house}`,
            facts.length === 0 ? "" : `PUBLIC FACTS:\n${facts.map(factLine).join("\n").slice(0, 1500)}`,
            documents === "" ? "" : `PUBLIC BUSINESS KNOWLEDGE:\n${documents}`,
        ]
            .filter((line) => line !== "")
            .join("\n\n")
    }
}
