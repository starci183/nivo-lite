import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { SAMPLE_NOW } from "./sales.data"

/** The context a Sales read or action runs in under the specs: the sample clock, the workspace's zone and the Vietnamese viewer; the member is the one given. */
export const salesContextOf = (memberId: string | null = "m1"): RunContext => ({
    workspaceId: "w1",
    memberId,
    now: new Date(SAMPLE_NOW),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
})
