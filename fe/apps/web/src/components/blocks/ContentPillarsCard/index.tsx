"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useContentCommand, type Pillar } from "@/hooks/content"
import { writeApplyPillarPresets, writeSavePillars } from "@/modules/db/content-settings/write-settings"
import { ContentPillarsCardBase, type PillarRow } from "./component"

/** Props of {@link ContentPillarsCard}. */
export interface ContentPillarsCardProps {
    /** The saved themes. */
    readonly pillars: ReadonlyArray<Pillar>
    /** Whether the member may change them. */
    readonly canManage: boolean
}

/** The content themes of the workspace and their weights. */
export const ContentPillarsCard = (props: ContentPillarsCardProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const [rows, setRows] = useState<ReadonlyArray<PillarRow>>(
        props.pillars.map((p) => ({
            key: p.id,
            id: p.id,
            name: p.name,
            description: p.description,
            weight: p.weight,
            active: p.active,
        })),
    )
    const [added, setAdded] = useState(0)
    const saved = () => command.say("ok", t("saveDone"))
    return (
        <ContentPillarsCardBase
            props={{ t, rows, canManage: props.canManage, isPending: command.isPending, note: command.note }}
            on={{
                change: (key, change) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...change } : r))),
                add: () => {
                    setAdded(added + 1)
                    setRows((cur) => [
                        ...cur,
                        { key: `new${added}`, name: "", description: "", weight: 1, active: true },
                    ])
                },
                remove: (key) => setRows((cur) => cur.filter((r) => r.key !== key)),
                preset: () => command.run("preset", () => writeApplyPillarPresets(), saved),
                save: () =>
                    command.run(
                        "save",
                        () =>
                            writeSavePillars(
                                rows.map(({ id, name, description, weight, active }) => ({
                                    id,
                                    name,
                                    description,
                                    weight,
                                    active,
                                })),
                            ),
                        saved,
                    ),
                dismissNote: command.dismiss,
            }}
        />
    )
}
