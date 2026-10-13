import type { ContentWorkbench } from "@modules/domain/content-items"
import { toContentActorType } from "./content-actor.mapper"
import { toContentFiguresType } from "./content-figures.mapper"
import { toContentItemType } from "./content-item.mapper"
import type { ContentWorkbenchType } from "./dto/content-workbench.type"

/** Maps the core workbench data to its typed GraphQL view. */
export const toContentWorkbenchType = (result: ContentWorkbench): ContentWorkbenchType => ({
    nowIso: result.nowIso,
    workspaceId: result.workspaceId,
    canManage: result.canManage,
    actor: toContentActorType(result.actor),
    items: result.items.map(toContentItemType),
    lastPlan: result.lastPlan,
    figures: toContentFiguresType(result.figures),
})
