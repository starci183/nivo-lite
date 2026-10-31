import type { SourceCategory } from "@modules/domain/knowledge-sources"
import type { KnowledgeCategoriesRequest } from "../../application/knowledge-categories.contracts"
import type { KnowledgeCategoryType } from "./dto/knowledge-category.type"

/** Maps the workspace of the call to the request. */
export const toKnowledgeCategoriesRequest = (workspaceId: string): KnowledgeCategoriesRequest => ({ workspaceId })

/** Maps the answer to the GraphQL types. */
export const toKnowledgeCategoryTypes = (result: ReadonlyArray<SourceCategory>): Array<KnowledgeCategoryType> =>
    result.map((category) => ({ ...category }))
