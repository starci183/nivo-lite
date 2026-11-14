import type { WorkspaceTheme } from "@modules/domain/workspace-settings"
import type { UpdateWorkspaceThemeRequest } from "../../application/update-workspace-theme.contracts"
import type { UpdateWorkspaceThemeInput } from "./dto/update-workspace-theme.input"
import type { WorkspaceThemeType } from "./dto/workspace-theme.type"

/** Maps the theme a manager sends to the update request. */
export const toUpdateWorkspaceThemeRequest = (
    workspaceId: string,
    input: UpdateWorkspaceThemeInput,
): UpdateWorkspaceThemeRequest => ({
    workspaceId,
    hue: input.hue,
    chroma: input.chroma,
    lightness: input.lightness,
    base: input.base,
    font: input.font,
    radius: input.radius,
    mode: input.mode,
})

/** Maps the stored theme to its GraphQL type; null stays null (the NIVO default). */
export const toWorkspaceThemeType = (theme: WorkspaceTheme | null): WorkspaceThemeType | null =>
    theme
