import { Injectable } from "@nestjs/common"
import type { KnowledgeSources } from "./gateway-turns.contracts"

@Injectable()
/**
 * The knowledge each running turn read, by its tool job, so the cards its tool calls open (an approval, a hand-off, a done action)
 * can name it as their sources. It lives exactly as long as the turn's tool token: kept when the token is minted, dropped when it is
 * revoked, and in the same process that verifies the token, so a tool call never sees the knowledge of another turn.
 */
export class TurnSourcesService {
    private readonly byJob = new Map<string, KnowledgeSources>()

    /** Keeps the knowledge of a starting turn. */
    keep(jobId: string, sources: KnowledgeSources): void {
        this.byJob.set(jobId, sources)
    }

    /** The knowledge of a running turn; none once the turn ended or for a job this process never started. */
    of(jobId: string): KnowledgeSources {
        return this.byJob.get(jobId) ?? []
    }

    /** Forgets the knowledge of a turn that ended. */
    drop(jobId: string): void {
        this.byJob.delete(jobId)
    }
}
