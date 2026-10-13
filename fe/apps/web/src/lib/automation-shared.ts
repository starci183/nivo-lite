/**
 * "Tự động hoá": types and pure helpers for the ready-made automations a shop owner switches on. No I/O, safe in client components.
 * The DEFINITIONS are data: resources/automation-templates/<key>.json (loaded by automation-templates.ts, synced to the
 * `automation_templates` table by `npm run seed:automations`). A definition is generic (keyed to events every business has); the shop's own
 * wording is generated ONCE at enable time from the active context and stored on the pipeline (body), the owner approves it.
 * Every customer-facing send goes through the authority gate (work_items): the owner's rule for the template's action decides whether the
 * message leaves by itself or waits as a decision. Nothing here sends anything.
 */
import type {
    L,
    ModuleScope,
    TemplateKey,
    ConfigValue,
    PipelineConfig,
    Capability,
    ChannelNeed,
    ConnectionNeed,
    Requires,
    FieldDef,
    GateAction,
    ContentMode,
    TemplatePack,
    TemplateDef,
    AutomationRunStatus,
    RunStep,
    AutomationRunView,
    Missing,
    AutomationCardView,
    ShopContext,
} from "@/modules/types"

export type {
    L,
    ModuleScope,
    TemplateKey,
    ConfigValue,
    PipelineConfig,
    Capability,
    ChannelNeed,
    ConnectionNeed,
    Requires,
    FieldDef,
    GateAction,
    ContentMode,
    TemplatePack,
    TemplateDef,
    AutomationRunStatus,
    RunStep,
    AutomationRunView,
    Missing,
    AutomationCardView,
    ShopContext,
} from "@/modules/types"
export const isTemplateKey = (v: unknown): v is TemplateKey =>
    typeof v === "string" && /^[a-z][a-z0-9_-]{2,60}$/.test(v)

/** The saved config over the template defaults, every setting coerced to its kind and clamped. Keys that are not settings (a sheet id) are kept as they are. */
export const resolveConfig = (
    def: TemplateDef,
    saved: Readonly<Record<string, unknown>> | null | undefined,
): PipelineConfig => {
    const out: Record<string, ConfigValue> = { ...def.defaults }
    for (const [k, v] of Object.entries(saved ?? {}))
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v
    for (const f of def.settings) {
        const v = out[f.key]
        if (f.kind === "number") out[f.key] = Math.min(f.max, Math.max(f.min, Math.round(Number(v) || 0)))
        else if (f.kind === "toggle") out[f.key] = v === true || v === "true"
        else if (f.kind === "time")
            out[f.key] = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))
                ? String(v)
                : String(def.defaults[f.key] ?? "00:00")
        else if (f.kind === "email")
            out[f.key] = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? "").trim()) ? String(v).trim().toLowerCase() : ""
        else
            out[f.key] =
                String(v ?? "")
                    .trim()
                    .slice(0, f.maxLength ?? 200) || String(def.defaults[f.key] ?? "")
    }
    return out
}

/** What a message is written with: the shop's real context and, per case, the customer's. */
export type MessageVars = {
    ten_shop: string
    gio_mo_cua?: string
    ten_khach?: string
    so_tien?: string
    ma_phieu?: string
    nhu_cau?: string
    uu_dai?: string
    /** Email templates: date, summary lines, waiting-decisions line, due date, period, days late. */
    ngay?: string
    tom_tat?: string
    viec_cho?: string
    han?: string
    ky?: string
    so_ngay_tre?: string
    /** Loyalty templates: points, tier name, the code of a one-time password. */
    diem?: string
    hang?: string
    ma?: string
    /** Delivery notice: the carrier and the tracking code. Contract renewal: the plan name and the end date. */
    hang_van_chuyen?: string
    ma_van_don?: string
    ten_goi?: string
    ngay_het_han?: string
}

const NEUTRAL: Readonly<Record<string, string>> = {
    ten_shop: "shop",
    gio_mo_cua: "giờ làm việc của shop",
    ten_khach: "bạn",
    so_tien: "",
    ma_phieu: "",
    nhu_cau: "dịch vụ bạn quan tâm",
    uu_dai: "ưu đãi riêng",
    dich_vu: "dịch vụ",
    gio_hen: "giờ hẹn",
    so_ngay: "vài",
    nguoi_lam: "",
    dia_chi: "",
    hang_van_chuyen: "đơn vị vận chuyển",
    ma_van_don: "",
    ten_goi: "dịch vụ",
    ngay_het_han: "ngày hết hạn",
}

/** Fill {ten_khach} {ten_shop} {gio_mo_cua} {so_tien} {ma_phieu} {nhu_cau} {uu_dai} and the email variables. An empty value reads as a neutral word, never as a raw {placeholder}. */
export const fillBody = (body: string, v: MessageVars): string =>
    body
        .replace(
            /\{([a-z_]+)\}/g,
            (_, k: string) =>
                ((v as Readonly<Record<string, string | undefined>>)[k] ?? "").trim() || (NEUTRAL[k] ?? ""),
        )
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+([.,!?])/g, "$1")
        .trim()

/** A friendly sample customer for previews. */
export const SAMPLE_VARS = {
    ten_khach: "chị Lan",
    so_tien: "350.000 ₫",
    ma_phieu: "INV-202610-0012",
    nhu_cau: "gói chăm sóc da",
    uu_dai: "ưu đãi 10% cho lần quay lại",
    ngay: "02/10/2026",
    tom_tat: "- Khách mới: 3\n- Tiền về: 1.200.000 ₫ (2 giao dịch)\n- Hoá đơn quá hạn: 1 (350.000 ₫)",
    viec_cho: "Đang có 2 việc chờ bạn quyết định trong NIVO.",
    han: "25/09/2026",
    ky: "09/2026",
    so_ngay_tre: "7",
    diem: "1.250",
    hang: "Bạc",
    dich_vu: "cắt tóc",
    gio_hen: "14:00 thứ Sáu, 09/10/2026",
    so_ngay: "30",
    nguoi_lam: "chị Mai",
    dia_chi: "12 Phố Thử Nghiệm",
    hang_van_chuyen: "Giao Hàng Nhanh",
    ma_van_don: "GHN123456789",
    ten_goi: "gói chăm sóc hằng tháng",
    ngay_het_han: "31/10/2026",
} as const

export const RUN_STATUS: ReadonlyArray<AutomationRunStatus> = [
    "queued",
    "running",
    "done",
    "skipped",
    "waiting_approval",
    "failed",
]

/** After this many consecutive owner approvals without edits, NIVO suggests "Cho tự gửi" (applied only when the owner accepts). */
export const TRUST_THRESHOLD = 20
