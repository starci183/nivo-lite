import { redirect } from "next/navigation";
import { intlLocale } from "@/i18n/core";
import { account } from "@/i18n/dict/account";
import { getLocale, getT } from "@/i18n/server";
import { listMySessions, sessionIdFromToken, type SessionRow } from "@/lib/account";
import { supabaseServer } from "@/lib/supabase/server";
import { AccountView, type SessionView } from "./component";
import { parseUserAgent } from "./userAgent";

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** Connected /account: reads the user, identities and the user's own device sessions. */
export const Account = async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const [{ data: sess }, t, locale] = await Promise.all([supabase.auth.getSession(), getT(account), getLocale()]);
  const currentId = sessionIdFromToken(sess.session?.access_token);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const relative = (iso: string | null): string => {
    if (!iso) return "-";
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    if (abs < 60) return t("justNow");
    const [unit, size] = UNITS.find(([, s]) => abs >= s) ?? UNITS[UNITS.length - 1];
    return rtf.format(Math.trunc(seconds / size), unit);
  };

  let rows: SessionRow[] = [];
  let sessionsFailed = false;
  try {
    rows = await listMySessions(supabase);
  } catch {
    sessionsFailed = true;
  }
  const sessions: SessionView[] = rows
    .map((r) => {
      const { browser, os } = parseUserAgent(r.user_agent);
      const device = browser && os ? t("deviceOn", { browser, os }) : (browser ?? os);
      return { id: r.id, device, ip: r.ip, created: relative(r.created_at), lastActive: relative(r.last_active_at), isCurrent: r.id === currentId };
    })
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

  const meta = user.user_metadata as { full_name?: string; name?: string };
  const providers = (user.identities ?? []).map((i) => i.provider);
  return (
    <AccountView
      name={meta.full_name || meta.name || user.email?.split("@")[0] || ""}
      email={user.email ?? ""}
      providers={providers}
      sessions={sessions}
      sessionsFailed={sessionsFailed}
    />
  );
};
