/** Where to go after authenticating when the URL gives no usable `next`. */
export const DEFAULT_NEXT = "/dashboard";

/**
 * Accept only same-site destinations. A path ("/invite/abc") is kept; an absolute URL is kept only when it
 * has the same origin (e-mail templates pass `{{ .RedirectTo }}`, a full URL). Anything else falls back.
 */
export const safeNext = (value: string | null | undefined, origin?: string): string => {
  if (!value) return DEFAULT_NEXT;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  if (origin) {
    try {
      const url = new URL(value);
      if (url.origin === origin) return `${url.pathname}${url.search}` || DEFAULT_NEXT;
    } catch {
      // not a URL
    }
  }
  return DEFAULT_NEXT;
};

/** The destination for an invite token: A2 owns acceptance at /invite/<token>. */
export const inviteNext = (token: string | null | undefined): string | undefined =>
  token && /^[\w-]{6,200}$/.test(token) ? `/invite/${token}` : undefined;
