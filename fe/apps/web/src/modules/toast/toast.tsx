import { toast as heroToast } from "@heroui/react"
import { IconTile } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"

/** Options a status toast accepts: the HeroUI ones, minus the `variant` each status already implies. */
type StatusToastOptions = Parameters<typeof heroToast.success>[1]

/** Per-status indicator of the one icon set, injected so every app toast reads the same; a caller can override `options.indicator`. */
const INDICATOR: Record<"success" | "danger" | "warning" | "info", ReactNode> = {
    success: <IconTile source={nivoIconSource("complete", "leading")} tone="success" size="sm" />,
    danger: <IconTile source={nivoIconSource("failure", "leading")} tone="danger" size="sm" />,
    warning: <IconTile source={nivoIconSource("warning", "leading")} tone="warning" size="sm" />,
    info: <IconTile source={nivoIconSource("info", "leading")} tone="accent" size="sm" />,
}

/**
 * App toast: a thin wrapper over the HeroUI imperative `toast` that injects the status indicator. Import THIS instead of the
 * HeroUI `toast` so every toast looks the same. Non-status members (`promise`, `close`, `clear`) pass through.
 */
export const toast = {
    ...heroToast,
    success: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.success(message, { indicator: INDICATOR.success, ...options }),
    danger: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.danger(message, { indicator: INDICATOR.danger, ...options }),
    warning: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.warning(message, { indicator: INDICATOR.warning, ...options }),
    info: (message: ReactNode, options?: StatusToastOptions) =>
        heroToast.info(message, { indicator: INDICATOR.info, ...options }),
}
