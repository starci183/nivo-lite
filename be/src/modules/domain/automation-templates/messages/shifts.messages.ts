import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the shifts automation templates: names, descriptions, settings, guardrails and starting wording. */
export const SHIFTS_TEMPLATE_MESSAGES: MessageBundle = {
    vi: {
        "automationTemplates.shifts_leave_gap.name": "Báo thiếu người khi có người xin nghỉ",
        "automationTemplates.shifts_leave_gap.description":
            "Khi nhân viên xin nghỉ, báo chủ ngay ca nào sẽ thiếu người và gợi ý hỏi ai thay.",
        "automationTemplates.shifts_leave_gap.line": "Khi có đơn xin nghỉ mới",
        "automationTemplates.shifts_leave_gap.guardrails.0":
            "Chỉ báo chủ và gợi ý người rảnh theo lịch và quy tắc đã đặt; không tự duyệt nghỉ hay tự gọi người thay.",
        "automationTemplates.shifts_month_close.name": "Chốt công tháng gửi Kế toán",
        "automationTemplates.shifts_month_close.description":
            "Đầu tháng tổng hợp giờ làm × lương theo giờ của từng người; gửi vào Office và file CSV qua email của chủ nếu đã có email.",
        "automationTemplates.shifts_month_close.line": "Mỗi tháng vào ngày và giờ bạn chọn (giờ Việt Nam)",
        "automationTemplates.shifts_month_close.settings.day.label": "Ngày trong tháng",
        "automationTemplates.shifts_month_close.settings.time.label": "Gửi lúc",
        "automationTemplates.shifts_month_close.guardrails.0":
            "Chỉ dùng giờ trong lịch đã đăng và lương theo giờ đã nhập; không tự chuyển tiền hay trả lương.",
        "automationTemplates.shifts_shift_reminder.name": "Nhắc ca trước giờ",
        "automationTemplates.shifts_shift_reminder.description":
            "Nhắc nhân viên trước giờ vào ca, và báo chủ nếu có người chưa vào ca sau vài phút.",
        "automationTemplates.shifts_shift_reminder.line": "Một khoảng thời gian trước mỗi ca đã đăng",
        "automationTemplates.shifts_shift_reminder.settings.beforeMinutes.suffix": "phút",
        "automationTemplates.shifts_shift_reminder.settings.beforeMinutes.label": "Nhắc trước giờ vào ca",
        "automationTemplates.shifts_shift_reminder.settings.noShowMinutes.suffix": "phút",
        "automationTemplates.shifts_shift_reminder.settings.noShowMinutes.label": "Báo chủ nếu chưa vào ca sau",
        "automationTemplates.shifts_shift_reminder.settings.noShowMinutes.hint":
            "Chỉ tính với người đã được xếp ca; nhân viên bấm Vào ca trong Lịch của tôi.",
        "automationTemplates.shifts_shift_reminder.guardrails.0":
            "Chỉ nhắc đúng ca đã đăng, đúng giờ và vị trí trong lịch; không thêm hứa hẹn hay thay đổi lịch.",
    },
    en: {
        "automationTemplates.shifts_leave_gap.name": "Gap alert when someone asks for leave",
        "automationTemplates.shifts_leave_gap.description":
            "When someone asks for leave, tells the owner right away which shifts would be short and who could cover.",
        "automationTemplates.shifts_leave_gap.line": "When a new leave request arrives",
        "automationTemplates.shifts_leave_gap.guardrails.0":
            "Only tells the owner and suggests free people by schedule and rules; never approves leave or calls a replacement itself.",
        "automationTemplates.shifts_month_close.name": "Monthly hours close for Accounting",
        "automationTemplates.shifts_month_close.description":
            "At the start of the month, sums hours × hourly wage per person and sends it to Office and, when mail is set up, a CSV to the owner.",
        "automationTemplates.shifts_month_close.line": "Every month on the day and time you pick (Vietnam time)",
        "automationTemplates.shifts_month_close.settings.day.label": "Day of the month",
        "automationTemplates.shifts_month_close.settings.time.label": "Send at",
        "automationTemplates.shifts_month_close.guardrails.0":
            "Only uses hours in published schedules and the hourly wages entered; never moves money or pays wages.",
        "automationTemplates.shifts_shift_reminder.name": "Shift reminders",
        "automationTemplates.shifts_shift_reminder.description":
            "Reminds staff before a shift and alerts the owner when someone has not checked in a few minutes after it started.",
        "automationTemplates.shifts_shift_reminder.line": "A while before every published shift",
        "automationTemplates.shifts_shift_reminder.settings.beforeMinutes.suffix": "minutes",
        "automationTemplates.shifts_shift_reminder.settings.beforeMinutes.label": "Remind before the shift",
        "automationTemplates.shifts_shift_reminder.settings.noShowMinutes.suffix": "minutes",
        "automationTemplates.shifts_shift_reminder.settings.noShowMinutes.label":
            "Alert the owner if not checked in after",
        "automationTemplates.shifts_shift_reminder.settings.noShowMinutes.hint":
            "Only for people scheduled; staff tap Vào ca in their schedule.",
        "automationTemplates.shifts_shift_reminder.guardrails.0":
            "Only reminds about published shifts with their real time and position; never promises or changes the schedule.",
    },
}
