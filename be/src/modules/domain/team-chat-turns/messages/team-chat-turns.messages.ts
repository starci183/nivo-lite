import type { PauseLine } from "../team-chat-turns.contracts"

/** The line an agent says when its room reached the limit of turns, per language of the team. */
export const PAUSE_LINES: Readonly<Record<"vi" | "en", PauseLine>> = {
    en: {
        title: "Pausing for a moment",
        text: "Many questions in this room in a short time: I pause for a few minutes, then I answer again.",
    },
    vi: {
        title: "Em tạm dừng một lúc",
        text: "Phòng này vừa hỏi em nhiều quá: em tạm dừng vài phút rồi trả lời tiếp nhé.",
    },
}

/**
 * The line NIVO (no agent) writes under a message that named an agent and started no chat turn, while the workspace's node rights
 * decide: nothing ran, and nobody answered in the agent's place.
 */
export const UNHANDLED_LINES: Readonly<Record<"vi" | "en", PauseLine>> = {
    en: {
        title: "No chat turn started",
        text: "This message named an assistant, but its chat turn did not start, so nothing ran. Send it again in a moment, or hand the work over on the assistant's own page.",
    },
    vi: {
        title: "Chưa bắt đầu được lượt trả lời",
        text: "Tin này có nhắc trợ lý nhưng lượt trả lời của trợ lý chưa bắt đầu được, nên chưa có gì chạy. Bạn nhắn lại sau ít phút, hoặc giao việc ở trang của trợ lý nhé.",
    },
}

/** The reason a hand-filed change carries when it retires the truth in force (Vietnamese, the shop's language). */
export const captureRetireReason = (name: string): string =>
    `${name} bấm "Ghi vào Second Brain" trên tin nhắn này để bỏ sự thật đang dùng; chờ chủ tiệm đồng ý.`

/** The reason a hand-filed change carries when it files a new value (Vietnamese, the shop's language). */
export const captureFileReason = (name: string): string =>
    `${name} bấm "Ghi vào Second Brain" trên tin nhắn này để ghi thành quy định của tiệm, thay cho giá trị đang dùng (nếu có); không nói thời hạn thì giữ một năm.`
