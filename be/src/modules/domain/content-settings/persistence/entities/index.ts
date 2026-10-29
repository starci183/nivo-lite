import { ContentSettingsEntity } from "./content-settings.entity"

export { ContentSettingsEntity }

/** The entities the content settings capability owns, for the app's connection. */
export const contentSettingsEntities = [ContentSettingsEntity] as const
