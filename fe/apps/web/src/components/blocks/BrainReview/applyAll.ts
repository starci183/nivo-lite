import type { useTranslations } from "next-intl"
import { adviceFor, useBrainCommand } from "@/hooks/brain"
import type { ReviewSingle } from "@/hooks/brain"

/** The single proposals NIVO suggests applying, and the command that applies them all at once. */
export const applyAllOf = (
    t: ReturnType<typeof useTranslations<"brain">>,
    singles: ReadonlyArray<ReviewSingle>,
    nowMs: number,
    command: ReturnType<typeof useBrainCommand>,
) => {
    const ready = singles.filter((single) => adviceFor(single.p, single.current, nowMs).action === "apply")
    return {
        readyCount: ready.length,
        applyAll: (): void =>
            ready.forEach((single, index) =>
                command.send(
                    "fact.decide",
                    { id: single.p.id, action: "apply" },
                    index === ready.length - 1 ? { done: t("appliedMany", { count: ready.length }) } : undefined,
                ),
            ),
    }
}
