"use client";

import { nivoIconSource, StarCiDashboardThemeBoundary, type IconName } from "@/ui";
import {
  Badge,
  Button,
  Drawer,
  DropdownMenu,
  Icon,
  IconButton,
  List,
  ListItem,
  Popover,
  SearchField,
  Sidebar,
  Text,
  TextAction,
  TopBar,
  WorkspaceShell,
  type DropdownMenuEntry,
  type SidebarItem,
} from "@starci/grammar/common";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { useT } from "@/i18n/client";
import { shell as shellDict } from "@/i18n/dict/shell";
import { FoundingBadge } from "@/components/promo/FoundingBadge";
import { WorkspaceSwitcher } from "@/features/onboarding/WorkspaceSwitcher";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { NivoLogo } from "@/components/brand/NivoLogo";
import {
  ACTIONS_CLASS_NAME,
  BADGE_CLASS_NAME,
  BRAND_CLASS_NAME,
  COMPACT_NAV_CLASS_NAME,
  NEW_LABEL_CLASS_NAME,
  NEW_PLUS_CLASS_NAME,
  NOTIFY_ITEM_CLASS_NAME,
  NOTIFY_LIST_CLASS_NAME,
  NOTIFY_PANEL_CLASS_NAME,
  PAGE_END_SPACER_CLASS_NAME,
  SR_ONLY_CLASS_NAME,
  TOPBAR_SEARCH_CLASS_NAME,
  WORKSPACE_NAME_CLASS_NAME,
} from "./classNames";

/** One pending approval as the bell list draws it. */
export type ConsoleShellPending = { readonly id: string; readonly leadName: string; readonly summary: string; readonly href: string };

/** One destination in the rail. `badge` is a real pending count (Office only). */
export type ConsoleShellNavItem = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: IconName;
  readonly isActive: boolean;
  readonly isPrimary: boolean;
  readonly badge: number;
};

/** Resolved facts the pure shell draws. */
export type ConsoleShellBaseData = {
  readonly workspaceName: string;
  readonly userName: string;
  readonly email: string;
  /** The member's role in this workspace, translated (chip next to the workspace name and in the user menu). */
  readonly roleLabel: string;
  readonly role: "owner" | "manager" | "staff";
  /** Workspaces the person belongs to: the name in the top bar opens the switcher. */
  readonly workspaces: ReadonlyArray<{ readonly id: string; readonly name: string; readonly role: "owner" | "manager" | "staff" }>;
  readonly currentWorkspaceId: string;
  readonly avatarUrl?: string;
  readonly nav: ReadonlyArray<ConsoleShellNavItem>;
  readonly isSigningOut: boolean;
  readonly pending: ReadonlyArray<ConsoleShellPending>;
  /** Real count of decisions waiting (drives the bell badge). */
  readonly pendingCount: number;
  readonly newEntries: ReadonlyArray<DropdownMenuEntry>;
  readonly isFoundingMember: boolean;
  /** The single dismissible campaign strip, or null on pages where nothing may sit above the work. */
  readonly strip: ReactNode;
};

/** Commands the shell reports back. */
export type ConsoleShellBaseActions = {
  readonly go: (href: string) => void;
  readonly search: (query: string) => void;
  readonly signOut: () => void;
  readonly switchWorkspace: (workspaceId: string) => void;
};

/** Props for {@link ConsoleShellBase}. */
export type ConsoleShellBaseProps = {
  readonly props: ConsoleShellBaseData;
  readonly on: ConsoleShellBaseActions;
  readonly children: ReactNode;
};

type FrameProps = { readonly shell: ConsoleShellBaseProps };

/** The compact bar keeps these three; the rest sit behind "More" (the wide Sidebar shows everything). */
const PHONE_TABS = new Set(["chat", "overview", "leads"]);

/** Office carries the real pending count as the item's trailing badge. */
const toSidebarItem = (item: ConsoleShellNavItem): SidebarItem => ({
  id: item.id,
  label: item.label,
  source: nivoIconSource(item.icon, "leading"),
  trailing: item.badge > 0 ? <Badge tone="accent">{item.badge}</Badge> : undefined,
});

type NavPartProps = { readonly items: ReadonlyArray<ConsoleShellNavItem>; readonly on: ConsoleShellBaseActions };

/** Wide navigation: the Grammar `Sidebar` rail owns item selection (SURFACE-4) and its rail edge. */
const WideNavigation = ({ items, on }: NavPartProps) => {
  const t = useT(shellDict);
  return (
    <Sidebar
      label={t("mainNavigation")}
      presentation="rail"
      groups={[{ id: "destinations", items: items.map(toSidebarItem) }]}
      selectedKey={items.find((item) => item.isActive)?.id}
      onAction={(id) => {
        const target = items.find((item) => item.id === id);
        if (target) on.go(target.href);
      }}
    />
  );
};

/** Leading glyph for a Button: the Heroicon resolved through the NIVO registry. */
const LeadingGlyph = ({ name }: { readonly name: IconName }) => <Icon source={nivoIconSource(name, "leading")} usage="leading" />;

/** Compact navigation (below the wide breakpoint): the first destinations as route actions, the rest in a drawer `Sidebar`. */
const CompactNavigation = ({ items, on }: NavPartProps) => {
  const t = useT(shellDict);
  const [isOpen, setOpen] = useState(false);
  const tabs = items.filter((item) => PHONE_TABS.has(item.id));
  const more = items.filter((item) => !PHONE_TABS.has(item.id));
  const isMoreActive = more.some((item) => item.isActive);
  return (
    <div className={COMPACT_NAV_CLASS_NAME}>
      {tabs.map((item) => (
        <TextAction
          key={item.id}
          href={item.href}
          appearance="route"
          size="sm"
          isCurrent={item.isActive}
          endContent={item.badge > 0 ? <Badge tone="accent">{item.badge}</Badge> : undefined}
        >
          {item.label}
        </TextAction>
      ))}
      <Drawer
        isOpen={isOpen}
        onOpenChange={setOpen}
        placement="bottom"
        title={t("navMore")}
        trigger={
          <Button variant={isMoreActive ? "secondary" : "ghost"} size="sm" startContent={<LeadingGlyph name="apps" />}>
            {t("navMore")}
          </Button>
        }
      >
        <Sidebar
          label={t("navMore")}
          presentation="drawer"
          groups={[{ id: "more", items: more.map(toSidebarItem) }]}
          selectedKey={more.find((item) => item.isActive)?.id}
          onAction={(id) => {
            const target = more.find((item) => item.id === id);
            if (!target) return;
            setOpen(false);
            on.go(target.href);
          }}
        />
      </Drawer>
    </div>
  );
};

type ShellPartProps = { readonly data: ConsoleShellBaseData; readonly on: ConsoleShellBaseActions };

const UserMenu = ({ data, on }: ShellPartProps) => {
  const t = useT(shellDict);
  const entries: ReadonlyArray<DropdownMenuEntry> = [
    {
      kind: "section",
      id: "workspaces",
      label: t("switchWorkspace"),
      items: [
        ...data.workspaces.map((w) => ({ id: `ws-${w.id}`, label: w.id === data.currentWorkspaceId ? `${w.name} ✓` : w.name, onAction: () => on.switchWorkspace(w.id) })),
        { id: "ws-new", label: t("newWorkspace"), href: "/onboarding?new=1" },
      ],
    },
    {
      kind: "section",
      id: "account",
      label: data.userName,
      items: [
        { id: "role", label: `${data.userName} · ${data.roleLabel}`, isDisabled: true },
        { id: "email", label: data.email || t("signedIn"), isDisabled: true },
        { id: "account", label: t("navAccount"), href: "/account" },
        { id: "signout", label: t("signOut"), onAction: on.signOut },
      ],
    },
  ];
  return (
    <DropdownMenu
      placement="bottom end"
      entries={entries}
      trigger={
        <Button variant="ghost" size="sm" startContent={<PersonAvatar name={data.userName} src={data.avatarUrl} size="sm" online />}>
          <span className={SR_ONLY_CLASS_NAME}>{data.userName}</span>
        </Button>
      }
    />
  );
};

const WorkspaceMenu = ({ data }: { readonly data: ConsoleShellBaseData }) => {
  const t = useT(shellDict);
  const [isOpen, setOpen] = useState(false);
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setOpen}
      placement="bottom"
      title={t("switchWorkspace")}
      trigger={
        // The workspace name is the switcher trigger: a quiet Grammar Button instead of a hand-styled raw button.
        <Button variant="ghost" size="sm">
          <span className={SR_ONLY_CLASS_NAME}>{`${t("switchWorkspace")}: `}</span>
          {data.workspaceName}
        </Button>
      }
    >
      <WorkspaceSwitcher
        workspaces={data.workspaces}
        currentId={data.currentWorkspaceId}
        roleLabels={{ owner: t("roleOwner"), manager: t("roleManager"), staff: t("roleStaff") }}
      />
    </Popover>
  );
};

const Notifications = ({ data, on }: ShellPartProps) => {
  const [isOpen, setOpen] = useState(false);
  const t = useT(shellDict);
  const count = Math.max(data.pendingCount, 0);
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setOpen}
      placement="bottom"
      title={count === 0 ? t("notifications") : t("pendingTitle", { count })}
      trigger={
        <IconButton
          source={nivoIconSource("notification", "leading")}
          label={t("notifications")}
          badge={count}
          badgeLabel={t("pendingTitle", { count })}
        />
      }
    >
      <div className={NOTIFY_PANEL_CLASS_NAME}>
        {count === 0 ? (
          <Text tone="muted" size="sm">
            {t("nothingWaiting")}
          </Text>
        ) : (
          <List label={t("pendingTitle", { count })} className={NOTIFY_LIST_CLASS_NAME}>
            {data.pending.slice(0, 5).map((item) => (
              <ListItem key={item.id} className={NOTIFY_ITEM_CLASS_NAME}>
                <TextAction href={item.href} appearance="inline" onFollow={() => setOpen(false)}>
                  {item.leadName}
                </TextAction>
                <Text size="sm" tone="muted" overflow="clamp-2">
                  {item.summary}
                </Text>
              </ListItem>
            ))}
          </List>
        )}
        <Button
          variant="outline"
          size="sm"
          width="fill"
          onPress={() => {
            setOpen(false);
            on.go("/chat");
          }}
        >
          {t("openOffice")}
        </Button>
      </div>
    </Popover>
  );
};

const Frame = ({ shell: { props: data, on, children } }: FrameProps) => {
  const t = useT(shellDict);
  // Chat pages fill the height with a pinned composer; every other page gets room at the end so bottom-right
  // controls can scroll clear of floating overlays (e.g. the host's badge).
  const pathname = usePathname();
  const isFullHeight = pathname === "/chat" || /^\/modules\/[^/]+\/chat/.test(pathname);
  const [query, setQuery] = useState("");
  return (
    <WorkspaceShell
      align="stretch"
      header={
        <TopBar
          position="sticky"
          brand={
            <div className={BRAND_CLASS_NAME}>
              <NivoLogo variant="mark" height={28} />
              <div className={WORKSPACE_NAME_CLASS_NAME}>
                <WorkspaceMenu data={data} />
              </div>
              <Badge tone={data.role === "staff" ? "neutral" : "accent"}>{data.roleLabel}</Badge>
              <div className={BADGE_CLASS_NAME}>
                <FoundingBadge isFoundingMember={data.isFoundingMember} />
              </div>
            </div>
          }
          actions={
            <div className={ACTIONS_CLASS_NAME}>
              <div className={TOPBAR_SEARCH_CLASS_NAME}>
                <SearchField
                  label={t("searchLeads")}
                  isLabelHidden
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onValueChange={setQuery}
                  onClear={() => setQuery("")}
                  onSubmit={(value) => {
                    const text = value.trim();
                    if (text.length > 0) on.search(text);
                  }}
                />
              </div>
              <DropdownMenu
                placement="bottom end"
                entries={data.newEntries}
                trigger={
                  <Button variant="secondary" size="sm">
                    <span className={NEW_LABEL_CLASS_NAME}>{t("newLabel")}</span>
                    <span className={NEW_PLUS_CLASS_NAME}>+</span>
                  </Button>
                }
              />
              <LocaleSwitch />
              <Notifications data={data} on={on} />
              <UserMenu data={data} on={on} />
            </div>
          }
        />
      }
      navigation={<WideNavigation items={data.nav} on={on} />}
      navigationLabel={t("mainNavigation")}
      navigationTrack="intrinsic"
      navigationVisibility="wide"
      compactNavigation={<CompactNavigation items={data.nav} on={on} />}
      compactNavigationLabel={t("mainNavigation")}
      primaryLabel={t("groupWorkspace")}
      primary={
        <>
          {children}
          {data.strip}
          {isFullHeight ? null : <div className={PAGE_END_SPACER_CLASS_NAME} aria-hidden="true" />}
        </>
      }
    />
  );
};

/** Draw the console chrome (Grammar WorkspaceShell: TopBar, wide Sidebar, compact navigation, one optional strip) around the routed page. */
export const ConsoleShellBase = (props: ConsoleShellBaseProps) => (
  <StarCiDashboardThemeBoundary content={Frame} contentProps={{ shell: props }} />
);
