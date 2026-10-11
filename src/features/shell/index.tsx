"use client";

import type { IconName } from "@/ui";
import type { DropdownMenuEntry } from "@starci/grammar/common";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import { shell } from "@/i18n/dict/shell";
import { FoundingOffer } from "@/components/promo/FoundingOffer";
import { signOut } from "@/lib/actions";
import { switchWorkspaceAction } from "@/features/onboarding/actions";
import { MemberProvider, isManager } from "./member-context";
import { ConsoleShellBase, type ConsoleShellNavItem } from "./component";
import type { ShellData } from "./queries";

type Destination = {
  readonly key: string;
  readonly label: "navOverview" | "navOffice" | "navAuthority" | "navInbox" | "navLeads" | "navResponsibilities" | "navDecisions" | "navAutomations" | "navBrain" | "navModules" | "navTeam" | "navConnections";
  readonly route: string;
  readonly icon: IconName;
  /** Rail section: the daily work, running the business, setting it up. */
  readonly group: "work" | "operate" | "setup";
  /** Other routes that belong to this destination (Documents live under the Brain). */
  readonly also?: ReadonlyArray<string>;
  /** Only owner and manager see this destination. */
  readonly managerOnly?: boolean;
};

/**
 * Office first: it is the page people come to. Three rail sections keep the daily work on top; the Brain owns the business
 * memory, so its documents (/knowledge) are no separate destination.
 */
const DESTINATIONS: ReadonlyArray<Destination> = [
  { key: "chat", label: "navOffice", route: "/chat", icon: "community", group: "work" },
  { key: "overview", label: "navOverview", route: "/dashboard", icon: "overview", group: "work" },
  { key: "leads", label: "navLeads", route: "/leads", icon: "account", group: "work" },
  { key: "responsibilities", label: "navResponsibilities", route: "/responsibilities", icon: "review", group: "work" },
  { key: "inbox", label: "navInbox", route: "/inbox", icon: "email", group: "work" },
  { key: "brain", label: "navBrain", route: "/brain", icon: "brain", group: "operate", also: ["/knowledge"] },
  { key: "authority", label: "navAuthority", route: "/authority", icon: "password", group: "operate" },
  { key: "decisions", label: "navDecisions", route: "/decisions", icon: "saved", group: "operate" },
  { key: "automations", label: "navAutomations", route: "/automations", icon: "agentos", group: "operate", managerOnly: true },
  { key: "modules", label: "navModules", route: "/m", icon: "apps", group: "setup" },
  { key: "team", label: "navTeam", route: "/team", icon: "talents", group: "setup", managerOnly: true },
  { key: "connections", label: "navConnections", route: "/connections", icon: "servers", group: "setup", managerOnly: true },
];

/** Pages where no promo strip sits with the work: the chat itself, the dashboard (which has its own hero) and the brain. */
const isStripFree = (pathname: string) => pathname.startsWith("/chat") || pathname.startsWith("/dashboard") || pathname.startsWith("/brain") || /^\/modules\/[^/]+\/chat/.test(pathname);

/** Props for {@link ConsoleShell}: plain session data from the server layout. */
export type ConsoleShellProps = {
  readonly workspaceName: string;
  readonly userName: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly data: ShellData;
  readonly promo: { readonly hasChatbot: boolean; readonly isFoundingMember: boolean };
  readonly children: ReactNode;
};

/** Connected console shell: route highlight, Office badge, search, menus and sign out. */
export const ConsoleShell = ({ workspaceName, userName, email, avatarUrl, data, promo, children }: ConsoleShellProps) => {
  const t = useT(shell);
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, startSignOut] = useTransition();
  const activeKey = pathname.startsWith("/modules/") && pathname.includes("/chat")
    ? "modules"
    : (DESTINATIONS.find((d) => [d.route, ...(d.also ?? [])].some((route) => pathname.startsWith(route)))?.key ?? "overview");
  const member = data.member;
  const roleLabel = member.role === "owner" ? t("roleOwner") : member.role === "manager" ? t("roleManager") : t("roleStaff");
  const nav: ReadonlyArray<ConsoleShellNavItem> = DESTINATIONS.filter((d) => !d.managerOnly || isManager(member)).map((d) => ({
    id: d.key,
    label: t(d.label),
    href: d.route,
    icon: d.icon,
    group: d.group,
    isActive: d.key === activeKey,
    isPrimary: d.key === "chat",
    badge: d.key === "chat" ? data.pendingCount : 0,
  }));
  const chatbot = data.agents.find((a) => a.module === "chatbot");
  const newEntries: ReadonlyArray<DropdownMenuEntry> = [
    { id: "new-lead", label: t("newLead"), href: "/leads?new=1" },
    { id: "add-module", label: t("addModule"), href: "/m" },
    chatbot
      ? { id: "test-chatbot", label: t("testChatbot"), href: `/modules/${chatbot.id}/chat` }
      : { id: "buy-chatbot", label: t("buyChatbot"), href: "/modules/new?module=chatbot" },
  ];
  const showStrip = !promo.hasChatbot && !isStripFree(pathname);
  return (
    <ConsoleShellBase
      props={{
        workspaceName,
        userName,
        email,
        roleLabel,
        workspaces: data.workspaces,
        currentWorkspaceId: data.currentWorkspaceId,
        role: member.role,
        avatarUrl: avatarUrl ?? undefined,
        nav,
        isSigningOut,
        pending: data.pending,
        pendingCount: data.pendingCount,
        newEntries,
        isFoundingMember: promo.isFoundingMember,
        strip: showStrip ? <FoundingOffer variant="strip" /> : null,
      }}
      on={{
        go: (href) => router.push(href),
        search: (query) => router.push(`/leads?q=${encodeURIComponent(query)}`),
        switchWorkspace: (workspaceId) => {
          if (workspaceId === data.currentWorkspaceId) return;
          void switchWorkspaceAction(workspaceId).then(() => {
            router.push("/chat");
            router.refresh();
          });
        },
        signOut: () => {
          startSignOut(async () => {
            await signOut();
          });
        },
      }}
    >
      <MemberProvider member={member}>{children}</MemberProvider>
    </ConsoleShellBase>
  );
};
