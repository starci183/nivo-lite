"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { CHANNEL_RULES, useContentCommand, type Cadence, type ContentChannel } from "@/hooks/content"
import { writeApplyCadencePresets, writeSaveCadence } from "@/modules/db/content-settings/write-settings"
import { ContentCadenceCardBase, type CadenceRow } from "./component"

/** Props of {@link ContentCadenceCard}. */
export interface ContentCadenceCardProps {
    /** The saved posting rhythm. */
    readonly cadence: ReadonlyArray<Cadence>
    /** Whether the member may change it. */
    readonly canManage: boolean
}

/** The posting rhythm of the workspace: posts per week, weekdays and time of each channel. */
export const ContentCadenceCard = (props: ContentCadenceCardProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const [rows, setRows] = useState<ReadonlyArray<CadenceRow>>(() =>
        CHANNEL_RULES.map((rule) => {
            const saved = props.cadence.find((c) => c.channel === rule.key)
            return {
                channel: rule.key,
                label: rule.label,
                on: saved !== undefined && saved.posts_per_week > 0,
                perWeek: saved?.posts_per_week ?? 3,
                days: saved?.days ?? [],
                time: saved?.post_time ?? "19:30",
            }
        }),
    )
    const saved = () => command.say("ok", t("saveDone"))
    const change = (channel: ContentChannel, patch: Partial<CadenceRow>) =>
        setRows((cur) => cur.map((r) => (r.channel === channel ? { ...r, ...patch } : r)))
    return (
        <ContentCadenceCardBase
            props={{
                t,
                rows,
                dayNames: t("dayShort").split(","),
                canManage: props.canManage,
                isPending: command.isPending,
                note: command.note,
            }}
            on={{
                change,
                preset: () => command.run("preset", () => writeApplyCadencePresets(), saved),
                save: () =>
                    command.run(
                        "save",
                        () =>
                            writeSaveCadence(
                                rows
                                    .filter((r) => r.on)
                                    .map((r) => ({
                                        channel: r.channel,
                                        postsPerWeek: r.perWeek,
                                        days: r.days,
                                        time: r.time,
                                    })),
                            ),
                        saved,
                    ),
                dismissNote: command.dismiss,
            }}
        />
    )
}
