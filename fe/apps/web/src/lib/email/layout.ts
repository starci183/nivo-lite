/**
 * The one email layout: a plain, responsive HTML wrapper with the shop's name and colour, plus a text alternative. No images.
 * The wording is never here: it is a template (with {{variables}}) the shop approved, rendered by `renderTemplate`.
 */
export const NIVO_ACCENT = "#e11d48";

const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fill {name} (or {{name}}) from `vars`, the placeholder style of resources/automation-templates; an unknown name becomes empty. Control characters never survive. */
export const renderTemplate = (template: string, vars: Readonly<Record<string, string | number | null | undefined>>): string =>
  template.replace(/\{\{?\s*([a-z0-9_]+)\s*\}?\}/gi, (_, k: string) => String(vars[k] ?? "")).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** A subject is one line. */
export const oneLine = (s: string, max = 200): string => s.replace(/[\r\n]+/g, " ").trim().slice(0, max);

type Block = { readonly kind: "p"; readonly lines: ReadonlyArray<string> } | { readonly kind: "ul"; readonly items: ReadonlyArray<string> };

/** Blank line = new paragraph; consecutive lines starting with "- " = a bullet list; other lines stay together. */
const blocks = (text: string): ReadonlyArray<Block> => {
  const out: Array<Block> = [];
  for (const para of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = para.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    let list: Array<string> = [];
    let prose: Array<string> = [];
    const flush = () => {
      if (prose.length) out.push({ kind: "p", lines: prose });
      if (list.length) out.push({ kind: "ul", items: list });
      prose = [];
      list = [];
    };
    for (const l of lines) {
      if (/^\s*[-•]\s+/.test(l)) {
        if (prose.length) flush();
        list.push(l.replace(/^\s*[-•]\s+/, ""));
      } else {
        if (list.length) flush();
        prose.push(l);
      }
    }
    flush();
  }
  return out;
};

export type RenderedEmail = { readonly html: string; readonly text: string };

/** Wrap an already-rendered plain body in the shop's layout. `accent` must be a #rrggbb colour (anything else falls back to NIVO's). */
export const renderEmail = (o: { shopName: string; accent?: string; title: string; body: string; footer?: string }): RenderedEmail => {
  const accent = /^#[0-9a-f]{6}$/i.test(o.accent ?? "") ? (o.accent as string) : NIVO_ACCENT;
  const shop = escapeHtml(oneLine(o.shopName, 80));
  const body = blocks(o.body).map((b) =>
    b.kind === "ul"
      ? `<ul style="margin:0 0 16px;padding-left:20px">${b.items.map((i) => `<li style="margin:0 0 6px">${escapeHtml(i)}</li>`).join("")}</ul>`
      : `<p style="margin:0 0 16px">${b.lines.map(escapeHtml).join("<br>")}</p>`,
  ).join("");
  const footer = escapeHtml(o.footer ?? `Email này được gửi bởi ${oneLine(o.shopName, 80)}.`);
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(oneLine(o.title))}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<tr><td style="background:${accent};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:700">${shop}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:14px 24px;background:#fafafa;color:#71717a;font-size:12px;line-height:1.5">${footer}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${oneLine(o.shopName, 80)}\n\n${o.body.replace(/\r\n/g, "\n").trim()}\n\n--\n${o.footer ?? `Email này được gửi bởi ${oneLine(o.shopName, 80)}.`}\n`;
  return { html, text };
};
