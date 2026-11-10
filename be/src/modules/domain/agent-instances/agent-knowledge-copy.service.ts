import { Injectable } from "@nestjs/common"
import { BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactStatus } from "@modules/domain/brain-facts"
import {
    KnowledgeSourcesError,
    KnowledgeSourcesReadService,
    KnowledgeSourcesService,
} from "@modules/domain/knowledge-sources"
import type { InstanceDocument } from "@modules/domain/knowledge-sources"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { copiedDocumentOf, copiedFactOf, copyTagOf } from "./agent-knowledge-copy.policy"
import type { CopyPublisher, KnowledgeCopy } from "./agent-instances.contracts"

/** The statuses of a private fact that were approved: in force now, or scheduled to be. */
const APPROVED: ReadonlyArray<FactStatus> = ["active", "scheduled"]

/** The statuses of a private fact still waiting for the owner. */
const WAITING: ReadonlyArray<FactStatus> = ["proposed"]

@Injectable()
/**
 * The instance-only knowledge layer: the facts and documents kept for the source agent alone come over to the new agent as its own
 * private items, each carrying where it came from. An approved fact is copied as approved; a fact still waiting for approval is never
 * copied as approved, it stays with the source. The shared layer needs no copy: every agent of the role reads it.
 */
export class AgentKnowledgeCopyService {
    constructor(
        private readonly facts: BrainFactsService,
        private readonly factReads: BrainFactsReadService,
        private readonly sources: KnowledgeSourcesService,
        private readonly sourceReads: KnowledgeSourcesReadService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Copies the private facts and documents of `source` onto the new agent's installation. */
    async copy(source: InstallationRecord, targetInstallationId: string, by: CopyPublisher): Promise<KnowledgeCopy> {
        const { workspaceId } = source
        const [approved, waiting] = await Promise.all([
            this.factReads.ofInstance(workspaceId, source.id, APPROVED),
            this.factReads.ofInstance(workspaceId, source.id, WAITING),
        ])
        await eachInOrder(approved, async (fact) => {
            await this.facts.propose(workspaceId, copiedFactOf(fact, source.name, targetInstallationId, by.memberId))
        })
        const documents = await this.sourceReads.readyOfInstance(workspaceId, source.id)
        const copied = await this.copyDocuments(source, documents, targetInstallationId, by)
        return {
            knowledgeFacts: approved.length,
            knowledgeDocuments: copied,
            knowledgeWaiting: waiting.length,
            knowledgeSkipped: documents.length - copied,
        }
    }

    private async copyDocuments(
        source: InstallationRecord,
        documents: ReadonlyArray<InstanceDocument>,
        targetInstallationId: string,
        by: CopyPublisher,
    ): Promise<number> {
        let copied = 0
        await eachInOrder(documents, async (document) => {
            try {
                await this.sources.addSource(
                    by.userId,
                    source.workspaceId,
                    copiedDocumentOf(document, source.moduleKey, targetInstallationId),
                )
                copied += 1
            } catch (cause: unknown) {
                if (!(cause instanceof KnowledgeSourcesError)) throw cause
                this.logger.warn(AgentInstancesLogEvent.DocumentCopyRefused, {
                    workspaceId: source.workspaceId,
                    tag: copyTagOf(document.id),
                    code: cause.code,
                })
            }
        })
        return copied
    }
}
