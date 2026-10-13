import type { EmailLayoutInput, RenderedEmail, TemplateVars } from "./mail.contracts"

/** The default accent of the email layout. */
export const NIVO_ACCENT = "#e11d48"

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu

type Block =
    | { readonly kind: "p"; readonly lines: ReadonlyArray<string> }
    | { readonly kind: "ul"; readonly items: ReadonlyArray<string> }

const escapeHtml = (text: string): string =>
    text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;")

/** Fills `{name}` or `{{name}}` from `vars` (an unknown name becomes empty); control characters never survive. */
export const renderTemplate = (template: string, vars: TemplateVars): string =>
    template
        .replace(/\{\{?\s*([a-z0-9_]+)\s*\}?\}/giu, (_match, name: string) => String(vars[name] ?? ""))
        .replace(CONTROL_CHARACTERS, "")

/** A subject is one line. */
export const oneLine = (text: string, max: number = 200): string => text.replace(/[\r\n]+/gu, " ").trim().slice(0, max)

const isBullet = (line: string): boolean => /^\s*[-•]\s+/u.test(line)
const withoutBullet = (line: string): string => line.replace(/^\s*[-•]\s+/u, "")

/** One paragraph of the text: consecutive bullets become a list, the other lines stay together. */
const blocksOfParagraph = (paragraph: string): ReadonlyArray<Block> => {
    const lines = paragraph
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== "")
    const out: Array<Block> = []
    let kind: Block["kind"] | null = null
    let current: Array<string> = []
    const flush = (): void => {
        if (kind === "ul") out.push({ kind: "ul", items: current })
        if (kind === "p") out.push({ kind: "p", lines: current })
        current = []
    }
    for (const line of lines) {
        const next = isBullet(line) ? "ul" : "p"
        if (kind !== null && kind !== next) flush()
        kind = next
        current.push(next === "ul" ? withoutBullet(line) : line)
    }
    flush()
    return out
}

/** A blank line starts a new paragraph; consecutive lines starting with "- " are a bullet list; other lines stay together. */
const blocksOf = (text: string): ReadonlyArray<Block> =>
    text
        .replace(/\r\n/gu, "\n")
        .split(/\n{2,}/u)
        .flatMap(blocksOfParagraph)

/** Wraps an already rendered plain body in the shop layout; `accent` must be a #rrggbb colour, anything else falls back to the default. */
export const renderEmail = (input: EmailLayoutInput): RenderedEmail => {
    const accent = input.accent !== undefined && /^#[0-9a-f]{6}$/iu.test(input.accent) ? input.accent : NIVO_ACCENT
    const shop = escapeHtml(oneLine(input.shopName, 80))
    const body = blocksOf(input.body)
        .map((block) =>
            block.kind === "ul"
                ? `<ul style="margin:0 0 16px;padding-left:20px">${block.items.map((item) => `<li style="margin:0 0 6px">${escapeHtml(item)}</li>`).join("")}</ul>`
                : `<p style="margin:0 0 16px">${block.lines.map(escapeHtml).join("<br>")}</p>`,
        )
        .join("")
    const footer = escapeHtml(input.footer)
    const html = `<!doctype html>
<html lang="${escapeHtml(input.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(oneLine(input.title))}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<tr><td style="background:${accent};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">${shop}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;color:#71717a;font-size:12px;line-height:1.5">${footer}</td></tr>
</table></td></tr></table></body></html>`
    const text = `${oneLine(input.shopName, 80)}\n\n${input.body.replace(/\r\n/gu, "\n").trim()}\n\n--\n${input.footer}\n`
    return { html, text }
}
