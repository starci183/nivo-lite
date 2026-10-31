"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useAgentInstallation } from "@/hooks/agentSettings"
import { useQueryAgentWorkSwr, useQueryWorkspaceAgentWorkSwr } from "@/hooks/swr"
import { WORK_POLL_BUSY_MS, WORK_POLL_IDLE_MS, toWorkView } from "@/modules/agentWork"
import type { AgentWorkStatusView } from "@/modules/types"
import type { OperatingMode } from "@/modules/installations"
import type { WorkbenchBandView, WorkbenchChannelView, WorkbenchStateTone } from "@/modules/types"
import { workbenchNeedsOf } from "@/modules/utils"
import type { WorkbenchNeedFacts } from "@/modules/utils"

/** What the band needs from the dashboard read: the mode, the channels bound, and the newest finished item. */
interface WorkbenchBandInput {
    readonly module: string
    readonly installationId: string | null
    readonly mode: OperatingMode | null
    readonly connections: ReadonlyArray<{ readonly id: string; readonly name: string; readonly isConnected: boolean }>
    /** The need facts (providers connected, tools that answered) the module's unmet needs are read from. */
    readonly needFacts: WorkbenchNeedFacts
    /** When the newest finished item was done, ISO; null when none. */
    readonly lastDoneAt: string | null
}

/** Whether a value the back end sends as a date is a readable instant, in milliseconds. */
const instantOf = (value: unknown): number | null => {
    const at = typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : Number.NaN
    return Number.isNaN(at) ? null : at
}

/** The kinds of state the work read can be in. */
type WorkStatusKind = AgentWorkStatusView["kind"]

/** The state dot of each kind the work read can be in: only a running turn echoes. */
const STATE_TONE: Readonly<Record<WorkStatusKind, WorkbenchStateTone>> = {
    working: "success",
    idle: "success",
    paused: "neutral",
    breaker: "warning",
    off: "neutral",
    workspaceOff: "neutral",
}

/**
 * The status band of a workbench: the state from the work read, polled every 5 seconds while a turn runs and every 30 otherwise,
 * the mode, the last activity (the later of the last turn and the newest finished item) and the channels. A fact that is not known
 * is left out, never drawn as a zero.
 */
export const useWorkbenchBand = (input: WorkbenchBandInput) => {
    const t = useTranslations("workbench")
    const ta = useTranslations("agentDashboard")
    const tm = useTranslations("modulesCore")
    const tw = useTranslations("agentWork")
    const format = useFormatter()
    const [now, setNow] = useState(() => Date.now())
    const { installation } = useAgentInstallation(input.installationId ?? "", input.module)
    const read = useQueryAgentWorkSwr(input.installationId === null ? null : { installationId: input.installationId }, {
        refreshInterval: (latest: { readonly turns: ReadonlyArray<{ readonly status: string }> } | undefined) =>
            latest?.turns.some((turn) => turn.status === "running") === true ? WORK_POLL_BUSY_MS : WORK_POLL_IDLE_MS,
        onSuccess: () => setNow(Date.now()),
    })
    const workspace = useQueryWorkspaceAgentWorkSwr({ refreshInterval: WORK_POLL_IDLE_MS })
    const data = read.data
    const isPaused = installation?.lifecycle === "paused"
    const isWorkspaceOff = workspace.data?.workEnabled === false
    const status = useMemo(
        () =>
            data === undefined
                ? null
                : toWorkView(data, {
                      t: tw,
                      format,
                      now,
                      isPaused,
                      isWorkspaceOff,
                      canEdit: false,
                      hrefOfWorkItem: () => "",
                  }).status,
        [data, tw, format, now, isPaused, isWorkspaceOff],
    )
    const lastTurn = instantOf(data?.state.lastTurnAt)
    const lastDone = instantOf(input.lastDoneAt)
    const last = Math.max(lastTurn ?? Number.NEGATIVE_INFINITY, lastDone ?? Number.NEGATIVE_INFINITY)
    const stateLabelOf = (kind: WorkStatusKind): string => {
        if (kind === "working") return t("stateWorking")
        if (kind === "idle") return t("stateRunning")
        if (kind === "breaker") return t("stateStopped")
        return t("statePaused")
    }
    const channels: ReadonlyArray<WorkbenchChannelView> = [
        ...input.connections
            .filter((connection) => connection.isConnected)
            .map((connection) => ({ id: connection.id, label: connection.name, isMissing: false })),
        ...workbenchNeedsOf(input.module)
            .filter(
                (need) =>
                    need.match.kind === "providers" &&
                    !need.match.providers.some((provider) => input.needFacts.connectedProviders.includes(provider)),
            )
            .map((need) => ({
                id: `need-${need.id}`,
                label: t("channelMissing", { name: t("channelMeta") }),
                isMissing: true,
            })),
    ]
    const view: WorkbenchBandView = {
        state:
            status === null
                ? installation === undefined
                    ? null
                    : { label: tm(`lifecycle_${installation.lifecycle}`), tone: "neutral", isEchoing: false }
                : {
                      label: stateLabelOf(status.kind),
                      tone: STATE_TONE[status.kind],
                      isEchoing: status.kind === "working",
                  },
        mode:
            input.mode === null
                ? null
                : input.mode === "autopilot"
                  ? { label: ta("modeAutopilot"), tone: "success" }
                  : { label: ta("modeAssist"), tone: "accent" },
        version: null,
        lastActivity: Number.isFinite(last)
            ? t("lastActivity", { when: format.relativeTime(last, now) })
            : t("noActivity"),
        channels,
    }
    return view
}
