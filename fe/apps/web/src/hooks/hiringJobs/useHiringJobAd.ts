"use client"

import { useFeatureReset, useFeatureLifetime } from "@/hooks/reuseables"
import type { HiringOwner } from "@/hooks/hiring"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import type { AdView, JobView } from "@/hooks/hiringWire"
import { useHiringJobCommands } from "./useHiringJobCommands"

/** The ad dialog of one job: the three variants (stored, or just written), the time the writing took, and the copy buttons. */
export const useHiringJobAd = (job: JobView | undefined, owner?: HiringOwner) => {
    const t = useTranslations("hiring")
    const run = useHiringRun(owner)
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const commands = useHiringJobCommands()
    const { copiedId, copy } = useHiringCopy(owner)
    const [written, setWritten] = useState<{ readonly jobId: string; readonly ads: AdView } | null>(null)
    const [meta, setMeta] = useState<string | null>(null)
    const generate = () => {
        const isCurrent = lifetime.capture()
        if (job === undefined || !isCurrent()) return
        run.dispatch(
            () => commands.generateAd(job.id),
            undefined,
            (result) => {
                if (!isCurrent()) return
                setWritten({
                    jobId: job.id,
                    ads: { facebook: result.facebook, zalo: result.zalo, topcv: result.topcv },
                })
                setMeta(
                    [
                        t("adMeta", { seconds: (result.ms / 1000).toFixed(1) }),
                        result.attempts > 1 ? t("adRewritten") : "",
                        result.sanitised ? t("adSanitised") : "",
                    ]
                        .filter((part) => part !== "")
                        .join(" "),
                )
            },
        )
    }
    useFeatureReset({
        isActive: owner?.isActive ?? true,
        isReady: true,
        scope: owner?.scope ?? "",
        onReset: () => {
            setWritten(null)
            setMeta(null)
        },
    })
    return {
        ads: written !== null && written.jobId === job?.id ? written.ads : (job?.ad ?? null),
        meta: written !== null && written.jobId === job?.id ? meta : null,
        copiedId,
        isPending: run.isPending,
        error: run.error,
        copy: (id: string, text: string) => copy(id, text),
        generate: () => generate(),
    }
}
