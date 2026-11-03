import { pillarBalance, type slotsForMonth } from "./calendar"
import { channelLabel } from "./content.templates"
import type { Cadence, ContentItem, Pillar } from "./types"

type Translate = (key: string, values?: Readonly<Record<string, string | number>>) => string
type Items = ReadonlyArray<ContentItem>

const percent = (share: number): number => Math.round(share * 100)

/** The share of each theme in the posts of the month, against the share it was given. */
export const balanceThemesOf = (t: Translate, pillars: ReadonlyArray<Pillar>, monthItems: Items, live: Items) =>
    live.length === 0
        ? []
        : pillarBalance(pillars, monthItems).map((row) => ({
              id: row.pillarId ?? "none",
              label: row.name || t("balanceNone"),
              value: Math.min(100, percent(row.actualShare)),
              max: 100,
              valueLabel: t("balanceActual", { n: row.count, p: percent(row.actualShare) }),
              target: row.targetShare > 0 ? t("balanceTarget", { p: percent(row.targetShare) }) : undefined,
          }))

/** The posts each channel has in the month against the posts its rhythm asks for. */
export const balanceChannelsOf = (
    t: Translate,
    cadence: ReadonlyArray<Cadence>,
    slots: ReturnType<typeof slotsForMonth>,
    live: Items,
) =>
    cadence
        .filter((c) => c.posts_per_week > 0)
        .map((c) => {
            const want = slots.filter((s) => s.channel === c.channel).length
            const have = live.filter((i) => i.channels.includes(c.channel)).length
            const label = channelLabel(t, c.channel)
            return {
                id: c.channel,
                label,
                value: want > 0 ? Math.min(want, have) : 0,
                max: Math.max(1, want),
                valueLabel: t("cadenceRow", { channel: label, n: have, want }),
                target: undefined,
            }
        })
