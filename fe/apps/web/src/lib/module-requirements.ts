import "server-only"
import { getSession } from "./session"
import { readRequirementFacts } from "@/modules/db"
import { moduleDef, type ModuleKey } from "./module-registry"

/** One module requirement (resources/modules/<key>/module.json "requires") the workspace does not meet yet. Soft: it never blocks installing or applying. */
export type UnmetRequirement = {
    readonly kind: "capability" | "connection"
    readonly key: string
    readonly label: { readonly vi: string; readonly en: string }
    readonly href: string
}

type Facts = { readonly providers: ReadonlySet<string>; readonly chatAgents: number; readonly staff: number }

const CHAT_PROVIDERS = ["telegram", "zalo_oa"]
const hasChat = (f: Facts): boolean => f.chatAgents > 0 || CHAT_PROVIDERS.some((p) => f.providers.has(p))

/** What each capability name in module.json means in this workspace. A capability the platform itself provides (video rendering, copy-ready social posts) is always met. */
const CAPABILITY: Readonly<
    Record<
        string,
        { readonly met: (f: Facts) => boolean; readonly label: { vi: string; en: string }; readonly href: string }
    >
> = {
    customer_chat: {
        met: hasChat,
        label: {
            vi: "một kênh chat với khách (website, Telegram hoặc Zalo)",
            en: "a customer chat channel (website, Telegram or Zalo)",
        },
        href: "/connections",
    },
    customer_messaging: {
        met: hasChat,
        label: {
            vi: "một kênh nhắn tin cho khách (Telegram hoặc Zalo)",
            en: "a way to message customers (Telegram or Zalo)",
        },
        href: "/connections",
    },
    email: {
        met: (f) => f.providers.has("smtp"),
        label: { vi: "Email gửi đi", en: "outgoing email" },
        href: "/connections?connect=smtp",
    },
    calendar: {
        met: (f) => f.providers.has("google"),
        label: { vi: "kết nối Google (lịch)", en: "a Google connection (calendar)" },
        href: "/connections",
    },
    staff_directory: {
        met: (f) => f.staff > 0,
        label: { vi: "danh sách nhân viên", en: "a staff list" },
        href: "/staff",
    },
    social_publish: {
        met: () => true,
        label: { vi: "đăng bài mạng xã hội", en: "social publishing" },
        href: "/connections",
    },
    video_render: { met: () => true, label: { vi: "dựng video", en: "video rendering" }, href: "/connections" },
}

const CONNECTION_LABEL: Readonly<Record<string, { vi: string; en: string }>> = {
    google: { vi: "kết nối Google", en: "a Google connection" },
    smtp: { vi: "Email gửi đi", en: "outgoing email" },
    webhook: { vi: "kết nối n8n / webhook", en: "an n8n / webhook connection" },
    telegram: { vi: "kết nối Telegram", en: "a Telegram connection" },
    zalo_oa: { vi: "kết nối Zalo OA", en: "a Zalo OA connection" },
}

/** The requirements of a module (`requires.capabilities`, `requires.connections`) that the signed-in workspace does not meet yet. */
export const unmetRequirements = async (module: ModuleKey): Promise<ReadonlyArray<UnmetRequirement>> => {
    const req = moduleDef(module).requires
    if (req.capabilities.length === 0 && req.connections.length === 0) return []
    const read = await readRequirementFacts((await getSession()).workspace.id)
    const counts = read.kind === "ok" ? read.value : { providers: [], chatAgents: 0, staff: 0, members: 0 }
    const facts: Facts = {
        providers: new Set(counts.providers),
        chatAgents: counts.chatAgents,
        staff: counts.staff + Math.max(0, counts.members - 1),
    }
    const out: Array<UnmetRequirement> = []
    for (const key of req.capabilities) {
        const def = CAPABILITY[key]
        if (def && !def.met(facts)) out.push({ kind: "capability", key, label: def.label, href: def.href })
    }
    for (const key of req.connections) {
        if (!facts.providers.has(key))
            out.push({
                kind: "connection",
                key,
                label: CONNECTION_LABEL[key] ?? { vi: key, en: key },
                href: "/connections",
            })
    }
    return out
}
