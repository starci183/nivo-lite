/**
 * Plain Vietnamese for the booking module: the messages a customer gets and the short phrases the owner sees. Pure (no I/O), no AI: every
 * customer-facing sentence here is fixed text filled with facts from the database, so nothing is invented. Times are in the business's zone.
 */
import { addDays, localDate, localHhmm, isoWeekday } from "./module-booking-availability";

const WEEKDAYS = ["", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy", "Chủ nhật"];

/** "14:30 thứ Sáu, 09/10/2026" */
export const whenText = (ms: number, tz: string): string => {
  const d = localDate(ms, tz);
  const [y, m, day] = d.split("-");
  return `${localHhmm(ms, tz)} ${WEEKDAYS[isoWeekday(d)]}, ${day}/${m}/${y}`;
};
/** "thứ Sáu, 09/10" */
export const dayText = (date: string): string => {
  const [, m, day] = date.split("-");
  return `${WEEKDAYS[isoWeekday(date)]}, ${day}/${m}`;
};

export const vndText = (n: number | null | undefined): string => (n === null || n === undefined ? "" : `${new Intl.NumberFormat("vi-VN").format(n)} ₫`);

export type BookingFacts = {
  readonly shop: string;
  readonly customer: string;
  readonly service: string;
  readonly resource: string;
  readonly startMs: number;
  readonly tz: string;
  readonly address?: string;
  readonly depositVnd?: number;
  readonly cancelWindowHours?: number;
};

const name = (c: string): string => c.trim() || "bạn";

export const confirmText = (f: BookingFacts): string =>
  [
    `Chào ${name(f.customer)}, ${f.shop} đã xác nhận lịch hẹn: ${f.service}, lúc ${whenText(f.startMs, f.tz)}${f.resource ? ` (${f.resource})` : ""}.`,
    f.address ? `Địa chỉ: ${f.address}.` : "",
    f.depositVnd && f.depositVnd > 0 ? `Tiền đặt cọc ${vndText(f.depositVnd)}, ${f.shop} sẽ nhắn cách chuyển khoản.` : "",
    f.cancelWindowHours ? `Bạn đổi hoặc hủy trước ${f.cancelWindowHours} giờ thì không mất phí nhé.` : "",
  ].filter(Boolean).join(" ");

export const holdText = (f: BookingFacts): string =>
  `Chào ${name(f.customer)}, ${f.shop} đã nhận yêu cầu đặt ${f.service} lúc ${whenText(f.startMs, f.tz)}. Bên mình đang kiểm tra lại và sẽ báo bạn trong ít phút.`;

export const rescheduleText = (f: BookingFacts, fromMs: number): string =>
  `Chào ${name(f.customer)}, ${f.shop} đã đổi lịch ${f.service} của bạn từ ${whenText(fromMs, f.tz)} sang ${whenText(f.startMs, f.tz)}${f.resource ? ` (${f.resource})` : ""}.`;

export const cancelText = (f: BookingFacts, feeVnd: number): string =>
  `Chào ${name(f.customer)}, ${f.shop} đã hủy lịch ${f.service} lúc ${whenText(f.startMs, f.tz)} theo yêu cầu của bạn.${feeVnd > 0 ? ` Theo chính sách, phí hủy sát giờ là ${vndText(feeVnd)}.` : ""} Hẹn bạn dịp khác nhé.`;

export const reminderText = (f: BookingFacts, hoursBefore: number): string =>
  `Chào ${name(f.customer)}, ${f.shop} nhắc bạn có lịch ${f.service} lúc ${whenText(f.startMs, f.tz)}${f.resource ? ` (${f.resource})` : ""}${hoursBefore >= 1 ? `, còn khoảng ${hoursBefore} giờ nữa` : ""}.${f.address ? ` Địa chỉ: ${f.address}.` : ""} Bạn nhắn lại nếu cần đổi giờ nhé.`;

export const waitlistOfferText = (f: BookingFacts): string =>
  `Chào ${name(f.customer)}, ${f.shop} vừa có chỗ trống cho ${f.service} lúc ${whenText(f.startMs, f.tz)}. Bạn muốn giữ lịch này thì nhắn lại cho bên mình nhé.`;

export const reviewText = (f: BookingFacts): string =>
  `Chào ${name(f.customer)}, cảm ơn bạn đã dùng ${f.service} tại ${f.shop}. Bạn thấy buổi hẹn thế nào ạ? Một lời nhận xét ngắn của bạn giúp bên mình rất nhiều.`;

export const comeBackText = (f: BookingFacts, days: number): string =>
  `Chào ${name(f.customer)}, đã khoảng ${days} ngày kể từ lần ${f.service} tại ${f.shop}. Bạn muốn đặt lịch lần tiếp theo không ạ? Bạn nhắn ngày giờ mong muốn, bên mình giữ chỗ cho bạn.`;

/** Offer a few free times (already sorted). */
export const offerText = (shop: string, service: string, slots: ReadonlyArray<number>, tz: string, wanted?: number): string =>
  slots.length === 0
    ? `${shop} hiện chưa còn chỗ trống cho ${service} trong thời gian bạn chọn. Bạn cho mình biết ngày khác, hoặc nhắn "danh sách chờ" để bên mình báo ngay khi có chỗ nhé.`
    : `${wanted ? `Khung giờ ${whenText(wanted, tz)} đã kín cho ${service}. ` : ""}${shop} còn các giờ trống: ${slots.map((s, i) => `${i + 1}) ${whenText(s, tz)}`).join("; ")}. Bạn chọn giờ nào thì nhắn lại cho bên mình nhé.`;

export const closedText = (shop: string, service: string): string =>
  `Ngày bạn chọn ${shop} không nhận lịch ${service}. Bạn cho mình biết ngày khác nhé.`;

/** A plain reason for the owner, why a request needs a decision. */
export const whyText = (why: string): string =>
  ({
    closed: "Cơ sở đóng cửa hoặc ngoài giờ làm việc vào lúc này.",
    full: "Giờ này đã có lịch khác, không còn chỗ.",
    too_soon: "Khách đặt sát giờ hơn mức tối thiểu bạn đặt.",
    too_far: "Khách đặt xa hơn số ngày bạn cho phép.",
    no_resource: "Chưa có người hoặc phòng phù hợp với dịch vụ này.",
    no_service: "Dịch vụ này đang tạm ngưng.",
    free: "",
  } as Record<string, string>)[why] ?? "";

/** The status words and colours of the workbench (one place). */
export const STATUS_LABEL: Readonly<Record<string, string>> = {
  requested: "Chờ xác nhận", confirmed: "Đã xác nhận", rescheduled: "Đã đổi lịch", cancelled: "Đã hủy", no_show: "Không đến", done: "Đã xong",
};

export const dayRangeLabel = (from: string, to: string): string => (from === to ? dayText(from) : `${dayText(from)} - ${dayText(to)}`);
export { addDays };
