import { ASPECTS, TARGET_SECONDS_MAX, TARGET_SECONDS_MIN } from "./video.constants"
import { inWorkspaceFolder, isRecord, readInputs, readScript } from "./video.script"
import { isGoal } from "./video.templates"
import type { Brand, MediaFileInfo, NewProject, ProjectPatch } from "./video.types"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether a value is a UUID. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

const aspectOf = (value: unknown): NewProject["aspect"] | undefined => ASPECTS.find((aspect) => aspect === value)

const secondsOf = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value)
        ? Math.min(TARGET_SECONDS_MAX, Math.max(TARGET_SECONDS_MIN, Math.round(value)))
        : undefined

/** Checks the input of a new project; null when it is not valid. */
export const guardNewProject = (raw: unknown): NewProject | null => {
    if (!isRecord(raw) || !isGoal(raw.goal)) return null
    const aspect = aspectOf(raw.aspect)
    const seconds = secondsOf(raw.targetSeconds)
    if (aspect === undefined || seconds === undefined) return null
    return {
        goal: raw.goal,
        aspect,
        targetSeconds: seconds,
        title: typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "",
        inputs: readInputs(raw.inputs),
    }
}

/** Checks the edits of a project; only the fields that are present and valid are kept. Null when the input is not an object. */
export const guardPatch = (raw: unknown, workspaceId: string): ProjectPatch | null => {
    if (!isRecord(raw)) return null
    const aspect = aspectOf(raw.aspect)
    const seconds = secondsOf(raw.targetSeconds)
    const inputs = raw.inputs === undefined ? undefined : readInputs(raw.inputs)
    return {
        ...(typeof raw.title === "string" ? { title: raw.title.trim().slice(0, 120) } : {}),
        ...(isGoal(raw.goal) ? { goal: raw.goal } : {}),
        ...(aspect === undefined ? {} : { aspect }),
        ...(seconds === undefined ? {} : { targetSeconds: seconds }),
        ...(inputs === undefined
            ? {}
            : {
                  inputs: {
                      ...inputs,
                      sourceIds: inputs.sourceIds.filter(isUuid).slice(0, 12),
                      media: inputs.media.filter((path) => inWorkspaceFolder(path, workspaceId)),
                  },
              }),
        ...(raw.script === undefined
            ? {}
            : {
                  script: readScript(raw.script).map((scene) => ({
                      ...scene,
                      media: scene.media !== null && inWorkspaceFolder(scene.media, workspaceId) ? scene.media : null,
                  })),
              }),
    }
}

/** Checks a brand kit; null when it is not an object. Colours stay as typed and are cleaned where they are stored. */
export const guardBrand = (raw: unknown): Brand | null => {
    if (!isRecord(raw)) return null
    const text = (value: unknown): string => (typeof value === "string" ? value : "")
    const orNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)
    return {
        shopName: text(raw.shopName),
        primary: text(raw.primary),
        secondary: text(raw.secondary),
        logoPath: orNull(raw.logoPath),
        musicTrack: orNull(raw.musicTrack),
        voice: text(raw.voice),
    }
}

/** Checks the facts of a file about to be uploaded; null when they are not valid. */
export const guardFile = (raw: unknown): MediaFileInfo | null => {
    if (!isRecord(raw)) return null
    if (typeof raw.name !== "string" || typeof raw.type !== "string" || typeof raw.size !== "number") return null
    return { name: raw.name.slice(0, 200), type: raw.type, size: raw.size }
}
