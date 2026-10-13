import { useTranslations } from "next-intl"
import { useState } from "react"
import { useHiringCopy, useHiringRun } from "@/hooks/hiring"
import type { AdView, JobView } from "@/hooks/hiringWire"
import { useHiringJobCommands } from "./useHiringJobCommands"

/** The ad dialog of one job: the three variants (stored, or just written), the time the writing took, and the copy buttons. */
export const useHiringJobAd = (job: JobView | undefined) => {
    const t = useTranslations("hiring")
    const run = useHiringRun()
    const commands = useHiringJobCommands()
    const { copiedId, copy } = useHiringCopy()
    const [written, setWritten] = useState<{ readonly jobId: string; readonly ads: AdView } | null>(null)
    const [meta, setMeta] = useState<string | null>(null)
    const generate = async () => {
        if (job === undefined) return
        const result = await run.exec(() => commands.generateAd(job.id))
        if (result === undefined) return
        setWritten({ jobId: job.id, ads: { facebook: result.facebook, zalo: result.zalo, topcv: result.topcv } })
        setMeta(
            [
                t("adMeta", { seconds: (result.ms / 1000).toFixed(1) }),
                result.attempts > 1 ? t("adRewritten") : "",
                result.sanitised ? t("adSanitised") : "",
            ]
                .filter((part) => part !== "")
                .join(" "),
        )
    }
    return {
        ads: written !== null && written.jobId === job?.id ? written.ads : (job?.ad ?? null),
        meta: written !== null && written.jobId === job?.id ? meta : null,
        copiedId,
        isPending: run.isPending,
        error: run.error,
        copy: (id: string, text: string) => void copy(id, text),
        generate: () => void generate(),
    }
}
