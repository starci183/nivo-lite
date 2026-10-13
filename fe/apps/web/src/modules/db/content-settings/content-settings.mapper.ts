import { isContentChannel, type AutomationKey, type ContentChannel } from "@/modules/content"

/** A validated pillar row of the settings form. */
export interface PillarInput {
    readonly id?: string
    readonly name: string
    readonly description: string
    readonly weight: number
    readonly active: boolean
}

/** A validated cadence row of the settings form. */
export interface CadenceInput {
    readonly channel: ContentChannel
    readonly postsPerWeek: number
    readonly days: ReadonlyArray<number>
    readonly time: string
}

/** A validated brand form. */
export interface BrandInput {
    readonly brandVoice: string
    readonly avoid: string
    readonly cta: string
    readonly hashtags: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const whole = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0)

/** Checks the rows of the pillars form; null when the input is not a list of rows. */
export const parsePillars = (input: unknown): Array<PillarInput> | null => {
    if (!Array.isArray(input)) return null
    const rows = input.flatMap((row: unknown) =>
        isObject(row)
            ? [
                  {
                      ...(typeof row.id === "string" && row.id !== "" ? { id: row.id } : {}),
                      name: text(row.name).trim().slice(0, 80),
                      description: text(row.description).trim().slice(0, 300),
                      weight: Math.max(0, Math.min(20, whole(row.weight))),
                      active: row.active === true,
                  },
              ]
            : [],
    )
    return rows.filter((row) => row.name !== "")
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Checks the rows of the cadence form; null when a row is malformed. */
export const parseCadence = (input: unknown): Array<CadenceInput> | null => {
    if (!Array.isArray(input)) return null
    const rows = input.flatMap((row: unknown) => {
        if (!isObject(row) || !isContentChannel(row.channel)) return []
        const days = Array.isArray(row.days) ? row.days.filter((d): d is number => typeof d === "number") : []
        return [
            {
                channel: row.channel,
                postsPerWeek: Math.max(0, Math.min(21, whole(row.postsPerWeek))),
                days: [...new Set(days.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b),
                time: text(row.time),
            },
        ]
    })
    return rows.every((row) => TIME.test(row.time)) ? rows : null
}

/** Checks the brand form; null when it is not an object. */
export const parseBrand = (input: unknown): BrandInput | null =>
    isObject(input)
        ? {
              brandVoice: text(input.brandVoice).trim().slice(0, 1500),
              avoid: text(input.avoid).trim().slice(0, 1500),
              cta: text(input.cta).trim().slice(0, 300),
              hashtags: text(input.hashtags),
          }
        : null

/** The automation keys the settings accept. */
export const parseAutomationKey = (input: unknown): AutomationKey | null =>
    (["today_reminder", "offer_draft", "weekly_summary"] as const).find((key) => key === input) ?? null
