import type { Connection, ConnectionLifecycle, ConnectionLifecycleChip, Provider } from "@/modules/types"

/** A catalog reader of the `connections` namespace: a key and the values of its placeholders. */
type Translate = (key: string, values?: Record<string, string | number>) => string

/** The four phases every provider's setup walks, in order: details, grant, check, hand to an agent. */
export const CONNECTION_PHASES: readonly ["info", "grant", "check", "agent"] = ["info", "grant", "check", "agent"]

/** How many phases a setup has. */
export const PHASE_COUNT: number = CONNECTION_PHASES.length

/**
 * The fact a provider writes once the grant phase is done (the bot is known, the OA is authorized, the account is linked). A pending
 * connection without it still stands in the grant phase; with it, it waits for its first event.
 */
const GRANTED_FACT: Readonly<Partial<Record<Provider, string>>> = {
    telegram: "bot_username",
    zalo_oa: "oa_id",
    sepay: "account_masked",
    payos: "account_masked",
    casso: "account_masked",
}

/**
 * Where one connection stands in the one life every connection shares: not connected, setting up (phase n of 4), waiting for its
 * first event, running, needing the owner, disconnected. "Not connected" belongs to a connector with no connection, never to a row.
 */
export const lifecycleOf = (connection: Pick<Connection, "provider" | "status" | "meta">): ConnectionLifecycle => {
    if (connection.status === "disconnected") return { id: "disconnected" }
    if (connection.status === "error") return { id: "attention" }
    if (connection.status === "connected") return { id: "running" }
    const fact = GRANTED_FACT[connection.provider]
    const isGranted = fact === undefined || (connection.meta[fact] ?? "") !== ""
    return isGranted ? { id: "waiting", phase: 3 } : { id: "setup", phase: 2 }
}

/** The tone each step of the life wears. */
const TONE: Readonly<Record<ConnectionLifecycle["id"], ConnectionLifecycleChip["tone"]>> = {
    unconnected: "neutral",
    setup: "warning",
    waiting: "warning",
    running: "success",
    attention: "danger",
    disconnected: "neutral",
}

/** The status badge of a step of the life, in the one vocabulary every Connections screen speaks. */
export const lifecycleChipOf = (life: ConnectionLifecycle, t: Translate): ConnectionLifecycleChip => ({
    label: life.id === "setup" ? t("life_setup", { n: life.phase ?? 1, total: PHASE_COUNT }) : t(`life_${life.id}`),
    tone: TONE[life.id],
    isDot: life.id !== "unconnected",
})

/** The phase a setup stands in (1-based): the step of a pending connection, all four for one that runs or ran. */
export const phaseOfLife = (life: ConnectionLifecycle): number => {
    if (life.id === "setup" || life.id === "waiting") return life.phase ?? 1
    return life.id === "unconnected" ? 1 : PHASE_COUNT + 1
}

/** A wizard whose steps map onto the four phases. */
export type WizardPhaseKind =
    | "zalo"
    | "telegram"
    | "telegramUser"
    | "money"
    | "smtp"
    | "drive"
    | "google"
    | "meta"
    | "webhook"
    | "imap"
    | "database"
    | "openapi"
    | "csv"
    | "csvDocs"

/**
 * The phase each step of a provider wizard belongs to (0-based, in step order), so every wizard's Stepper shows the same four phases.
 */
export const WIZARD_PHASES: Readonly<Record<WizardPhaseKind, ReadonlyArray<number>>> = {
    zalo: [0, 1, 1, 2, 3],
    telegram: [0, 1, 2, 3],
    telegramUser: [0, 1, 2, 2, 3],
    money: [0, 0, 1, 2, 3],
    smtp: [0, 0, 1, 2],
    drive: [1, 2, 3],
    google: [1, 3],
    meta: [1, 1, 3, 3],
    webhook: [0, 1, 2, 3],
    imap: [1, 2, 2, 3],
    database: [1, 2, 2, 3],
    openapi: [0, 1, 2, 2, 2, 2, 3],
    csv: [0, 1, 1, 2, 3],
    csvDocs: [0, 1, 2, 3],
}
