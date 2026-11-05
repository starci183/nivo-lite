import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { runTimelineBlock } from "../blocks/run-timeline.block"
import type { RunView } from "../rows/run-timeline-view"

/** Every status the run read of a run timeline can be in, for the stories and the specs. */
export interface RunTimelineFixtureSlots {
    /** A run that finished. */
    readonly ready: DataSlot<RunView>
    /** A run stopped at a step that waits for an approval. */
    readonly waiting: DataSlot<RunView>
    /** A run parked on a step that failed, with the way to run it again. */
    readonly parked: DataSlot<RunView>
    /** No run is chosen, or the run has no step. */
    readonly empty: DataSlot<RunView>
    /** The read failed. */
    readonly error: DataSlot<RunView>
    /** The first read is in flight. */
    readonly loading: DataSlot<RunView>
    /** The viewer may not see the run. */
    readonly forbidden: DataSlot<RunView>
}

/** The props of a run timeline. */
export const runTimelineFixtureProps: z.infer<(typeof runTimelineBlock)["props"]> = {
    label: { vi: "Cac buoc cua lan chay", en: "Steps of the run" },
    idle: { vi: "Chon mot lan chay de xem cac buoc", en: "Choose a run to see its steps" },
}

const RECEIVED_AT = "2026-11-05T08:00:00.000Z"

/** A run that went the quote branch to its end. */
export const RUN_DONE: RunView = {
    id: "run-1",
    status: "done",
    steps: [
        {
            id: "s1",
            node: "inbound",
            label: "Tin nhan den",
            state: "done",
            at: RECEIVED_AT,
            inputSummary: "Zalo: Cho minh hoi gia ban ghe",
            outputSummary: "Khach moi, ghi nhan hoi thoai",
            durationMs: 120,
        },
        {
            id: "s2",
            node: "quote",
            label: "Soan bao gia",
            state: "done",
            at: "2026-11-05T08:00:01.000Z",
            inputSummary: "Ban ghe go, 2 cai",
            outputSummary: "Bao gia 4.800.000 d",
            durationMs: 2400,
            calls: [
                { tool: "catalogue.search", ok: true, summary: "3 mat hang" },
                { tool: "knowledge.search", ok: true, summary: null },
            ],
        },
        {
            id: "s3",
            node: "send-quote",
            label: "Gui bao gia",
            state: "done",
            at: "2026-11-05T08:00:05.000Z",
            outputSummary: "Da gui",
            durationMs: 65_000,
            calls: [{ tool: "chat.send", ok: true, summary: "Zalo OA, da gui" }],
            effectKey: "chat.send:run-1:s3",
        },
    ],
}

/** A run that stopped before the quote goes out, waiting for an approval. */
export const RUN_WAITING: RunView = {
    id: "run-2",
    status: "waiting",
    steps: [
        {
            id: "w1",
            node: "inbound",
            label: "Tin nhan den",
            state: "done",
            at: RECEIVED_AT,
            inputSummary: "Zalo: Cho minh hoi gia ban ghe",
            durationMs: 110,
        },
        {
            id: "w2",
            node: "quote",
            label: "Soan bao gia",
            state: "done",
            at: "2026-11-05T08:00:01.000Z",
            outputSummary: "Bao gia 4.800.000 d",
            durationMs: 2100,
            calls: [{ tool: "catalogue.search", ok: true, summary: "3 mat hang" }],
        },
        {
            id: "w3",
            node: "approval",
            label: "Cho duyet bao gia",
            state: "waiting",
            at: "2026-11-05T08:00:04.000Z",
            inputSummary: "Bao gia 4.800.000 d",
            approvalPath: "/approvals/ap-1",
        },
    ],
}

/** A run parked on the step that sends the quote: the door refused, and the run waits to be run again. */
export const RUN_PARKED: RunView = {
    id: "run-3",
    status: "parked",
    steps: [
        {
            id: "p1",
            node: "inbound",
            label: "Tin nhan den",
            state: "done",
            at: RECEIVED_AT,
            inputSummary: "Zalo: Cho minh hoi gia ban ghe",
            durationMs: 90,
        },
        {
            id: "p2",
            node: "send-quote",
            label: "Gui bao gia",
            state: "parked",
            at: "2026-11-05T08:00:05.000Z",
            inputSummary: "Bao gia 4.800.000 d",
            durationMs: 30_000,
            calls: [{ tool: "chat.send", ok: false, summary: "Zalo OA het han ket noi" }],
            effectKey: "chat.send:run-3:p2",
            reason: "Zalo OA het han ket noi, ket noi lai roi chay lai",
        },
    ],
}

/** The runs in every status. */
export const runTimelineFixtures: RunTimelineFixtureSlots = {
    ready: { items: RUN_DONE },
    waiting: { items: RUN_WAITING },
    parked: { items: RUN_PARKED },
    empty: { isEmpty: true },
    error: { isError: true },
    loading: { isLoading: true },
    forbidden: { isForbidden: true },
}
