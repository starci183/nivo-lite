"use client"

import { useSearchParams } from "next/navigation"
import { TeamChatBase } from "@/components/blocks/TeamChat/component"
import { chatGridOf } from "@/hooks/paneFrame"
import type { TeamChatMessageRow, TeamChatRoomRow } from "@/modules/teamChat"

const ROOMS: ReadonlyArray<TeamChatRoomRow> = [
    { id: "r1", kind: "direct", title: "Mây CSKH", other: { kind: "agent", id: "a1", name: "Mây CSKH" }, preview: "Mây CSKH: Báo cáo tuần đã sẵn sàng", when: "14:20", unread: 2, mentions: 1, isSelected: true },
    { id: "r2", kind: "direct", title: "Lan Phạm", other: { kind: "user", id: "u2", name: "Lan Phạm" }, preview: "Lan Phạm: Mai mình họp lúc 9 giờ nhé", when: "Hôm qua", unread: 0, mentions: 0, isSelected: false },
    { id: "r3", kind: "group", title: "Vận hành", other: null, preview: "Bạn: Đã chốt lịch giao hàng", when: "30/10", unread: 0, mentions: 0, isSelected: false },
]

const MESSAGES: ReadonlyArray<TeamChatMessageRow> = [
    { id: "m1", kind: "text", side: "outgoing", author: null, authorName: "Bạn", body: "@Mây CSKH tổng hợp đơn hàng tuần này giúp mình", timeLabel: "14:10", dayLabel: "Hôm nay", pinned: false, files: [], reportHref: null, approval: null },
    { id: "m2", kind: "report", side: "incoming", author: { kind: "agent", id: "a1", name: "Mây CSKH" }, authorName: "Mây CSKH", body: "Tuần này có 42 đơn, doanh thu 18.400.000đ. 3 đơn đang chờ xác nhận thanh toán.", timeLabel: "14:18", dayLabel: null, pinned: true, files: [], reportHref: "/vi/workspaces/w/agents/chatbot/i/work?run=abc", approval: null },
    { id: "m3", kind: "approval", side: "incoming", author: { kind: "agent", id: "a1", name: "Mây CSKH" }, authorName: "Mây CSKH", body: "Xin duyệt giảm giá 15% cho đơn #1042 của khách Hoa Xinh (đơn 2.300.000đ).", timeLabel: "14:19", dayLabel: null, pinned: false, files: [], reportHref: null, approval: { decisionId: "d1", status: "pending", decidedBy: "", decidedAt: "", canDecide: true } },
    { id: "m4", kind: "approval", side: "incoming", author: { kind: "agent", id: "a1", name: "Mây CSKH" }, authorName: "Mây CSKH", body: "Xin duyệt hoàn tiền 450.000đ cho đơn #1038.", timeLabel: "14:20", dayLabel: null, pinned: false, files: [], reportHref: null, approval: { decisionId: "d2", status: "approved", decidedBy: "Nguyễn Thị Mây", decidedAt: "14:21", canDecide: false } },
    { id: "m5", kind: "system", side: "incoming", author: null, authorName: "", body: "Lan Phạm đã tham gia cuộc trò chuyện", timeLabel: "14:22", dayLabel: null, pinned: false, files: [], reportHref: null, approval: null },
]

const COPY = {
    grid: "Trò chuyện nhóm", title: "Trò chuyện", listLabel: "Các cuộc trò chuyện", threadLabel: "Tin nhắn", newChat: "Cuộc mới",
    refresh: "Làm mới", back: "Quay lại danh sách", tabAll: "Tin nhắn", tabPinned: "Đã ghim", tabsLabel: "Lọc tin nhắn",
    pickTitle: "Chọn một cuộc trò chuyện", pickBody: "Chọn một người, một agent hoặc một nhóm ở bên trái.",
    roomsEmpty: "Chưa có cuộc trò chuyện nào.", roomsEmptyAction: "Bắt đầu cuộc đầu tiên", threadEmpty: "Chưa có tin nhắn.",
    errorBody: "Không tải được.", members: "thành viên", openFull: "Mở đầy đủ", groupLine: "Nhóm", mute: "Tắt thông báo", unmute: "Bật thông báo",
}

const MESSAGES_COPY = {
    pin: "Ghim tin nhắn", unpin: "Bỏ ghim", pinned: "Đã ghim", report: "Báo cáo", approvalPending: "Đang chờ duyệt",
    approvalApproved: "Đã duyệt", approvalRefused: "Đã từ chối", approvalExpired: "Đã hết hạn", approve: "Duyệt", refuse: "Từ chối",
    olderLabel: "Xem tin cũ hơn", openRun: "Xem lần chạy", decidedBy: "bởi",
}

const noop = (): void => undefined

/** A throwaway preview of the chat surface with fixture props: no data, no session. */
const Page = () => {
    const query = useSearchParams()
    const phone = query.get("phone") === "main" ? "main" : "list"
    const isAgent = query.get("agent") === "1"
    const draft = query.get("draft") ?? ""
    return (
        <TeamChatBase
            props={{
                copy: COPY,
                labels: { empty: "Trống", forbidden: "Không có quyền", error: "Lỗi", retry: "Thử lại" },
                roomsSlot: { items: ROOMS },
                threadSlot: { items: MESSAGES },
                isWaiting: false,
                selectedId: "r1",
                selectedTitle: "Mây CSKH",
                selectedOther: { kind: "agent", id: "a1", name: "Mây CSKH" },
                memberCount: 2,
                tab: "all",
                hasList: !isAgent,
                grid: chatGridOf({ hasList: !isAgent, phone }),
                fullHref: isAgent ? "/vi/chat" : null,
                messagesCopy: MESSAGES_COPY,
                hasOlder: true,
                isLoadingOlder: false,
                decidingId: null,
                decideError: null,
                composer: {
                    formLabel: "Soạn tin nhắn", messageLabel: "Tin nhắn", placeholder: "Nhập tin nhắn, dùng @ để nhắc một người hoặc agent",
                    sendLabel: "Gửi", draft, typing: query.get("typing") === "1" ? "Lan Phạm đang soạn tin…" : null,
                    file: { label: "Đính kèm tệp", removeLabel: "Bỏ tệp", accept: "image/*", name: query.get("file") === "1" ? "bang-gia-thang-11.pdf" : null, canPick: true },
                    isSending: false, isLoading: false, canSend: true, error: null,
                    suggestions: draft.startsWith("@") ? [{ kind: "agent", id: "a1", name: "Mây CSKH" }, { kind: "user", id: "u2", name: "Lan Phạm" }] : [],
                },
                isMuted: false,
                newChat: null,
            }}
            on={{
                refresh: noop, select: noop, back: noop, tab: noop, older: noop, pin: noop, decide: noop, draft: noop, mention: noop,
                send: noop, file: noop, fileClear: noop, toggleMute: noop, openNewChat: noop, openFull: noop, newChatOpenChange: noop,
                newChatDirect: noop, newChatGroupName: noop, newChatGroupMembers: noop, newChatStartDirect: noop, newChatCreateGroup: noop,
            }}
        />
    )
}

export default Page
