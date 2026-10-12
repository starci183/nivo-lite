import { matchPage } from "./match";
import { GUIDE_PAGES, pageAt, pagesFor, type GuideLocale, type GuidePage } from "./sitemap";
import type { GuideLink, GuideReply, GuideTurn } from "./types";

/**
 * The NIVO guide's brain, free of Next and of the database so it can be checked on its own: a question that clearly names a place is
 * answered from the site map (no tokens); anything else goes to the model with the map the member may see, and the model's answer is
 * cut down to links that exist in that map. The guide only shows the way; it never acts.
 */

export type GuideGenerate = (messages: ReadonlyArray<{ role: "system" | "user"; content: string }>) => Promise<{ ok: true; output: string } | { ok: false }>;

export type GuideInput = {
  readonly question: string;
  /** The console path the member is on (for "you are here"). */
  readonly path: string;
  readonly history: ReadonlyArray<GuideTurn>;
  readonly locale: GuideLocale;
  readonly isManager: boolean;
};

const COPY = {
  vi: {
    empty: "Anh/chị muốn làm gì trên NIVO? Em chỉ đường cho.",
    managerOnly: (title: string) => `Phần ${title} do chủ sở hữu hoặc quản lý thiết lập. Anh/chị nhờ họ giúp nhé.`,
    busy: "Em đang bận một chút, anh/chị hỏi lại sau ít phút nhé. Trong lúc chờ, anh/chị có thể mở menu bên trái để tìm trang cần dùng.",
    open: (title: string) => `Mở ${title}`,
  },
  en: {
    empty: "What would you like to do in NIVO? I'll show you the way.",
    managerOnly: (title: string) => `${title} is set up by an owner or manager. Ask one of them to help.`,
    busy: "I'm a bit busy right now. Ask again in a few minutes, or use the menu on the left to find the page.",
    open: (title: string) => `Open ${title}`,
  },
} as const;

const linkTo = (p: GuidePage, locale: GuideLocale): GuideLink => ({
  pageId: p.id, label: COPY[locale].open(p.title[locale]), href: p.path, ...(p.target ? { target: p.target } : {}),
});

/** One line per page the member may see: what the model is allowed to point at. */
const mapLines = (pages: ReadonlyArray<GuidePage>, locale: GuideLocale): string =>
  pages.map((p) => `- ${p.id} | ${p.title[locale]} | ${p.what[locale]} | ${p.steps[locale].join(" > ")}`).join("\n");

const SYSTEM = (locale: GuideLocale, isManager: boolean): string => [
  locale === "vi"
    ? "Bạn là trợ lý điều hướng của NIVO OS, phần mềm vận hành cho doanh nghiệp nhỏ Việt Nam. Bạn chỉ giúp người dùng tìm đúng trang và cách làm trong NIVO."
    : "You are the navigation assistant of NIVO OS, an operations app for small Vietnamese businesses. You only help people find the right page and how to do things in NIVO.",
  locale === "vi" ? "Xưng em, gọi anh/chị. Câu ngắn, rõ, không dùng dấu chấm than, không emoji." : "Be brief and plain. No exclamation marks, no emoji.",
  "Rules:",
  "- Only point to page ids from the PAGES list. Never invent a page, a URL, a menu or a feature that is not in the list.",
  "- You only explain where to go and what to press. You cannot do anything for the user (no connecting, sending, deleting or paying).",
  isManager ? "- The user is an owner or manager." : "- The user is staff: settings pages are not in their list; if they ask for one, say an owner or manager does it.",
  "- If the question is not about using NIVO, say in one sentence that you only help with NIVO, and point to the closest page if there is one.",
  "- If you are not sure, say so and suggest the most likely page.",
  'Reply with ONLY a JSON object: {"answer": string (at most 60 words, in the user\'s language), "steps": string[] (0-5 short steps), "pages": string[] (0-3 page ids from PAGES, most relevant first)}.',
].join("\n");

/** The first JSON object in a model reply (tolerates code fences and prose around it). */
const parseObject = (raw: string): Record<string, unknown> | null => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(raw.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export const answerGuide = async (input: GuideInput, generate: GuideGenerate): Promise<GuideReply> => {
  const { locale, isManager } = input;
  const copy = COPY[locale];
  const question = input.question.trim().slice(0, 500);
  if (!question) return { answer: copy.empty, steps: [], links: [], source: "map" };

  // 1. The site map: a clear hit costs nothing. Staff asking for a settings page are told who does it.
  const hit = matchPage(question, GUIDE_PAGES);
  if (hit && hit.managerOnly && !isManager) return { answer: copy.managerOnly(hit.title[locale]), steps: [], links: [], source: "map" };
  if (hit) return { answer: `${hit.title[locale]}: ${hit.what[locale]}`, steps: hit.steps[locale], links: [linkTo(hit, locale)], source: "map" };

  // 2. The model, with only the pages this member may be sent to.
  const allowed = pagesFor(isManager);
  const here = pageAt(input.path);
  const history = input.history.slice(-6).map((t) => `${t.role === "user" ? "User" : "Guide"}: ${clip(t.text, 300)}`).join("\n");
  const user = [
    `PAGES (id | name | what it is for | how):\n${mapLines(allowed, locale)}`,
    `CURRENT PAGE: ${here ? `${here.id} (${here.title[locale]})` : input.path}`,
    history ? `CONVERSATION SO FAR:\n${history}` : "",
    `QUESTION: ${question}`,
  ].filter(Boolean).join("\n\n");
  const r = await generate([{ role: "system", content: SYSTEM(locale, isManager) }, { role: "user", content: user }]);
  if (!r.ok) return { answer: copy.busy, steps: [], links: [], source: "busy" };
  const o = parseObject(r.output);
  const answer = typeof o?.answer === "string" ? clip(o.answer.trim(), 600) : "";
  if (!answer) return { answer: copy.busy, steps: [], links: [], source: "busy" };
  const steps = (Array.isArray(o?.steps) ? o.steps : []).filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, 5).map((s) => clip(s.trim(), 160));
  const ids = (Array.isArray(o?.pages) ? o.pages : []).filter((s): s is string => typeof s === "string");
  const links = [...new Set(ids)].flatMap((id) => allowed.filter((p) => p.id === id)).slice(0, 3).map((p) => linkTo(p, locale));
  return { answer, steps, links, source: "ai" };
};
