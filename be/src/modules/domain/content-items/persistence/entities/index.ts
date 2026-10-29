import { ContentItemEntity } from "./content-item.entity"

export { ContentItemEntity }

/** The entities the content items capability owns, for the app's connection. */
export const contentItemsEntities = [ContentItemEntity] as const
