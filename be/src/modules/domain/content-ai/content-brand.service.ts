import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityService } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isJsonObject, trimmedText } from "./content-ai-prompt.policy"
import type { BrandMaterial } from "./content-ai-prompt.policy"
import { SELECT_CONTENT_PUBLIC_SOURCES, SELECT_CONTENT_SETUP } from "./persistence/content-ai.sql"

@Injectable()
/** Public marketing context; private sources and instance-only facts never reach these prompts. */
export class ContentBrandService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly authority: AuthorityService,
        private readonly facts: BrainFactsService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Reads the applied setup, house voice, public knowledge and facts. */
    async material(workspaceId: string): Promise<BrandMaterial> {
        const [shop, authority, snapshots, sources, facts] = await Promise.all([
            this.workspaces.nameOf(workspaceId),
            this.authority.load({ workspaceId }),
            this.entityManager.query<Array<{ snapshot: unknown }>>(SELECT_CONTENT_SETUP, [workspaceId]),
            this.entityManager.query<Array<{ title: string; topic: string | null; content: string }>>(
                SELECT_CONTENT_PUBLIC_SOURCES,
                [workspaceId],
            ),
            this.facts.forView(workspaceId, "customer", "content", null, 80),
        ])
        const snapshot = isJsonObject(snapshots[0]?.snapshot) ? snapshots[0].snapshot : {}
        const evidence = (key: string): string => {
            const gates = isJsonObject(snapshot.gates) ? snapshot.gates : {}
            const gate = gates[key]
            return isJsonObject(gate) ? trimmedText(gate.evidence) : ""
        }
        return {
            shop,
            authority: {
                brandVoice: authority?.brand_voice ?? "",
                replyStyle: authority?.reply_style ?? "",
                limitsNote: authority?.limits_note ?? "",
            },
            setup: {
                summary: trimmedText(snapshot.summary),
                facts: Array.isArray(snapshot.facts)
                    ? snapshot.facts.flatMap((fact: unknown) =>
                          isJsonObject(fact) && typeof fact.text === "string" ? [fact.text] : [],
                      )
                    : [],
                tone: evidence("tone"),
                claimsLimits: evidence("claims_limits"),
                audience: evidence("audience"),
                channels: evidence("channels"),
            },
            sources,
            brainFacts: facts.map((fact) => ({
                subject: fact.subjectLabel,
                attribute: fact.attributeLabel,
                value: fact.value,
            })),
        }
    }
}
