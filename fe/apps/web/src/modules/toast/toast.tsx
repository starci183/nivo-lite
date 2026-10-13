import { toast as heroToast } from "@heroui/react"
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    XCircleIcon,
} from "@heroicons/react/24/outline"
import type { ReactNode } from "react"

/** Options a status toast accepts: the HeroUI ones, minus the `variant` each status already implies. */
type StatusToastOptions = Parameters<typeof heroToast.success>[1]

/** Per-status indicator (size-6) of the one icon set, injected so every app toast reads the same; a caller can override `options.indicator`. */
const INDICATOR: Record<"success" | "danger" | "warning" | "info", ReactNode> = {
    success: <CheckCircleIcon className="size-6 text-success-soft-foreground" />,
    danger: <XCircleIcon className="size-6 text-danger-soft-foreground" />,
    warning: <ExclamationTriangleIcon className="size-6 text-warning-soft-foreground" />,
    info: <InformationCircleIcon className="size-6 text-accent-soft-foreground" />,
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
