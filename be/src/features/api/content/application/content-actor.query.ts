import { Query } from "@nestjs/cqrs"
import type { ContentActor } from "@modules/domain/content-items"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetContentActorRequest } from "./content-actor.contracts"

/** The signed-in member and their content permissions. */
export class GetContentActorQuery extends Query<ContentActor> {
    constructor(readonly params: ExecuteParams<GetContentActorRequest>) {
        super()
    }
}
