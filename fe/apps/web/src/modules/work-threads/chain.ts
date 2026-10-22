import type { StatusTone } from "@/modules/types"

/** The tone of a chain step or card status: done and approved are good, waiting is a warning, refused and stopped are bad. */
export const chainStatusTone = (status: string): StatusTone => {
    if (status === "done" || status === "approved" || status === "complete") return "success"
    if (status === "waiting" || status === "pending" || status === "running") return "warning"
    if (status === "rejected" || status === "expired" || status === "stopped") return "danger"
    return "neutral"
}

/** The message key that names a step kind. */
export const stepKindKey = (kind: string): "kindAskApproval" | "kindHandOff" | "kindAssign" | "kindSelf" => {
    if (kind === "ask_approval") return "kindAskApproval"
    if (kind === "hand_off") return "kindHandOff"
    if (kind === "assign") return "kindAssign"
    return "kindSelf"
}
