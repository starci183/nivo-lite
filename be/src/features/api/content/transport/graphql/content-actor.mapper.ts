import type { ContentActor } from "@modules/domain/content-items"
import type { ContentActorType } from "./dto/content-actor.type"

/** Maps the authorized caller to the GraphQL actor type. */
export const toContentActorType = (result: ContentActor): ContentActorType => ({ ...result })
