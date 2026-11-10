import type { CatalogAgent, CatalogGrant, CatalogKnowledge } from "./agent-catalog.contracts"
import type { LensCounts } from "./agents.contracts"
import type { AgentGrantView } from "./agents.port"

/** The grants one agent holds, in the order the owner of the grants answered them. */
export const grantsOfAgent = (agentId: string, grants: ReadonlyArray<AgentGrantView>): ReadonlyArray<CatalogGrant> =>
    grants
        .filter((grant) => grant.agentId === agentId)
        .map(
            ({ connection }): CatalogGrant => ({
                connectionId: connection.id,
                provider: connection.provider,
                name: connection.name,
                botUsername: connection.botUsername,
                accountMasked: connection.accountMasked,
                status: connection.status,
                access: connection.access,
                purpose: connection.purpose,
            }),
        )

/** What an agent reads: the documents of its lens, and its facts approved out of all (approved plus waiting). */
export const catalogKnowledgeOf = (counts: LensCounts, waiting: number): CatalogKnowledge => {
    const approved = counts.facts.public + counts.facts.internal + counts.facts.restricted
    return {
        audience: counts.audience,
        documents: counts.documents.public + counts.documents.internal,
        factsApproved: approved,
        factsTotal: approved + waiting,
        factsWaiting: waiting,
    }
}

/** One catalog entry from the pieces read for the agent. */
export const catalogAgentOf = (
    agentId: string,
    installationId: string | null,
    grants: ReadonlyArray<AgentGrantView>,
    knowledge: CatalogKnowledge,
): CatalogAgent => ({ agentId, installationId, grants: grantsOfAgent(agentId, grants), knowledge })
