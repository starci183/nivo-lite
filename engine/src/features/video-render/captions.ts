import { aspectSize, type Aspect } from "./video-spec";

/**
 * Burned-in text as one ASS (Advanced SubStation) file rendered by libass in the final pass. libass does the real line breaking with the
 * font's own metrics (WrapStyle 0 = smart, balanced lines, breaks only at spaces, which in Vietnamese are syllable boundaries). On top of that
 * we keep a number with its unit and the last two words together (the no-break space \h) so a caption never ends with one orphan syllable.
 */

export type TextCue = { readonly start: number; readonly end: number; readonly text: string; readonly kind: "caption" | "headline" | "brand"; readonly light?: boolean };

const FONT = "Be Vietnam Pro";

const esc = (s: string): string => s.replace(/[{}]/g, (c) => (c === "{" ? "(" : ")")).replace(/\\/g, "/").replace(/\r?\n+/g, "\\N");

const UNITS = /^(phút|giờ|ngày|tháng|năm|đồng|đ|k|kg|g|ml|l|cm|mm|m|km|%|người|cái|bó|hộp|chai|suất|lần|tuần|vnđ|vnd)[.,!?]*$/i;

/** Keep short tails and number+unit pairs on one line. */
export const keepTogether = (text: string): string => {
  const words = text.trim().replace(/\s+/g, " ").split(" ");
  if (words.length < 2) return words.join(" ");
  const out: string[] = [];
  words.forEach((w, i) => {
    out.push(w);
    if (i === words.length - 1) return;
    const next = words[i + 1];
    // A number stays with its next number group or unit; a one- or two-letter word (và, là, ở, đi) never ends a line; the last two words stay together.
    const joinNext = (/\d/.test(w) && (/\d/.test(next) || UNITS.test(next))) || i === words.length - 2 || w.length <= 2;
    out.push(joinNext ? "\\h" : " ");
  });
  return out.join("");
};

const stamp = (sec: number): string => {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

/** #rrggbb -> ASS &HAABBGGRR (alpha 00 = opaque). */
const ass = (hex: string, alpha = 0): string => {
  const h = hex.replace("#", "");
  const a = alpha.toString(16).toUpperCase().padStart(2, "0");
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
};

export const buildAss = (aspect: Aspect, cues: ReadonlyArray<TextCue>): string => {
  const { width: W, height: H } = aspectSize(aspect);
  const base = Math.min(W, H);
  const sideMargin = Math.round(base * 0.085);
  const captionSize = Math.round(base * 0.056);
  const headlineSize = Math.round(base * 0.088);
  const brandSize = Math.round(base * 0.038);
  const captionBottom = Math.round(H * (aspect === "9:16" ? 0.15 : aspect === "1:1" ? 0.09 : 0.08));
  const brandTop = Math.round(H * (aspect === "9:16" ? 0.055 : 0.04));
  const pad = Math.round(captionSize * 0.32);
  const styles = [
    // Name, Fontname, Fontsize, Primary, Secondary, Outline(box), Back(shadow), Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    `Style: Caption,${FONT},${captionSize},&H00FFFFFF,&H00FFFFFF,${ass("#000000", 0x40)},&H00000000,-1,0,0,0,100,100,0,0,3,${pad},0,2,${sideMargin},${sideMargin},${captionBottom},1`,
    `Style: Headline,${FONT},${headlineSize},&H00FFFFFF,&H00FFFFFF,&H64000000,&H96000000,-1,0,0,0,100,100,0,0,1,${Math.round(base * 0.006)},${Math.round(base * 0.004)},5,${sideMargin},${sideMargin},0,1`,
    `Style: HeadlineDark,${FONT},${headlineSize},&H00141414,&H00141414,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,1,0,0,5,${sideMargin},${sideMargin},0,1`,
    `Style: Brand,${FONT},${brandSize},${ass("#ffffff", 0x30)},&H00FFFFFF,&H50000000,&H00000000,-1,0,0,0,100,100,2,0,1,${Math.round(base * 0.0025)},${Math.round(base * 0.002)},8,${sideMargin},${sideMargin},${brandTop},1`,
  ];
  const lines = cues
    .filter((c) => c.end > c.start && c.text.trim() !== "")
    .map((c) => {
      const style = c.kind === "caption" ? "Caption" : c.kind === "brand" ? "Brand" : c.light ? "HeadlineDark" : "Headline";
      const fade = c.kind === "brand" ? "" : "{\\fad(220,180)}";
      const body = c.kind === "brand" ? esc(c.text) : keepTogether(esc(c.text).replace(/\\N/g, " "));
      return `Dialogue: ${c.kind === "caption" ? 2 : 1},${stamp(c.start)},${stamp(c.end)},${style},,0,0,0,,${fade}${body}`;
    });
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...lines,
    "",
  ].join("\n");
};

/** Relative luminance of #rrggbb (0..1): picks dark or light headline text for a card. */
export const luminance = (hex: string): number => {
  const v = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * v(0) + 0.7152 * v(1) + 0.0722 * v(2);
};
