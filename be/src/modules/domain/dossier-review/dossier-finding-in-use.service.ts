import { Injectable } from "@nestjs/common"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FindingInUse } from "./dossier-review.contracts"
import { inUseOf, type FactStanding } from "./in-use-fact.policy"
import type { DossierFindingEntity } from "./persistence/entities"

@Injectable()
/** For the contradictions of a page of findings, the value agents read now: where each cited fact stands, read once per page. */
export class DossierFindingInUseService {
    constructor(private readonly facts: BrainFactsReadService) {}

    /** The value in use for each contradiction of the rows, by finding id; a finding that is not a contradiction has no entry. */
    async ofFindings(
        workspaceId: string,
        rows: ReadonlyArray<DossierFindingEntity>,
    ): Promise<ReadonlyMap<string, FindingInUse | null>> {
        const contradictions = rows.filter((row) => row.kind === "contradiction")
        const ids = [
            ...new Set(
                contradictions.flatMap((row) =>
                    row.evidence.flatMap((item) => (item.factId === null ? [] : [item.factId])),
                ),
            ),
        ]
        const known = await Promise.all(ids.map((id) => this.facts.get(workspaceId, id)))
        const standings = new Map<string, FactStanding>(
            known.flatMap((fact) =>
                fact === null ? [] : [[fact.id, { status: fact.status, value: fact.value }] as const],
            ),
        )
        return new Map(contradictions.map((row) => [row.id, inUseOf(row.evidence, standings)]))
    }
}
