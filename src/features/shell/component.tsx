"use client";

import { NivoIcon, nivoIconSource, StarCiDashboardThemeBoundary, type IconName } from "@/ui";
import { Badge, Button, DropdownMenu, IconButton, Popover, SearchField, Text, type DropdownMenuEntry } from "@starci/grammar/common";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LocaleSwitch } from "@/i18n/LocaleSwitch";
import { useT } from "@/i18n/client";
import { shell as shellDict } from "@/i18n/dict/shell";
import { FoundingBadge } from "@/components/promo/FoundingBadge";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { NivoLogo } from "@/components/brand/NivoLogo";
import {
  ACTIONS_CLASS_NAME,
  BADGE_CLASS_NAME,
  BELL_COUNT_CLASS_NAME,
  BELL_WRAP_CLASS_NAME,
  COLUMN_CLASS_NAME,
  MAIN_CLASS_NAME,
  PAGE_END_SPACER_CLASS_NAME,
  NEW_LABEL_CLASS_NAME,
  NEW_PLUS_CLASS_NAME,
  NOTIFY_ITEM_CLASS_NAME,
  NOTIFY_LIST_CLASS_NAME,
  NOTIFY_PANEL_CLASS_NAME,
  RAIL_BADGE_CLASS_NAME,
  RAIL_CLASS_NAME,
  RAIL_GLYPH_ACCENT_CLASS_NAME,
  RAIL_GLYPH_ACTIVE_CLASS_NAME,
  RAIL_GLYPH_CLASS_NAME,
  RAIL_GLYPH_MUTED_CLASS_NAME,
  RAIL_ITEM_ACTIVE_CLASS_NAME,
  RAIL_ITEM_CLASS_NAME,
  RAIL_LABEL_CLASS_NAME,
  RAIL_LOGO_CLASS_NAME,
  RAIL_NAV_CLASS_NAME,
  PHONE_HIDDEN_CLASS_NAME,
  PHONE_ONLY_CLASS_NAME,
  RAIL_SPACER_CLASS_NAME,
  RAIL_USER_CLASS_NAME,
  ROOT_CLASS_NAME,
  SR_ONLY_CLASS_NAME,
  TOPBAR_CLASS_NAME,
  TOPBAR_IDENTITY_CLASS_NAME,
  TOPBAR_MARK_CLASS_NAME,
  TOPBAR_SEARCH_CLASS_NAME,
  TOPBAR_SPACER_CLASS_NAME,
  TOPBAR_USER_CLASS_NAME,
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
};

/** Props for {@link ConsoleShellBase}. */
export type ConsoleShellBaseProps = {
  readonly props: ConsoleShellBaseData;
  readonly on: ConsoleShellBaseActions;
  readonly children: ReactNode;
};

type FrameProps = { readonly shell: ConsoleShellBaseProps };

type RailItemProps = { readonly item: ConsoleShellNavItem };

/** Phone bottom bar keeps these four; the rest sit behind "Thêm" (the desktop rail shows everything). */
const PHONE_TABS = new Set(["chat", "overview", "leads", "authority"]);

const RailItem = ({ item, phoneHidden = false }: RailItemProps & { readonly phoneHidden?: boolean }) => {
  const glyphTone = item.isPrimary ? RAIL_GLYPH_ACCENT_CLASS_NAME : item.isActive ? RAIL_GLYPH_ACTIVE_CLASS_NAME : RAIL_GLYPH_MUTED_CLASS_NAME;
  return (
    <Link
      href={item.href}
      aria-current={item.isActive ? "page" : undefined}
      className={`${RAIL_ITEM_CLASS_NAME}${item.isActive ? ` ${RAIL_ITEM_ACTIVE_CLASS_NAME}` : ""}${phoneHidden ? ` ${PHONE_HIDDEN_CLASS_NAME}` : ""}`}
    >
      <span className={`${RAIL_GLYPH_CLASS_NAME} ${glyphTone}`}>
        <NivoIcon props={{ name: item.icon, usage: "leading" }} />
        {item.badge > 0 ? (
          <span className={RAIL_BADGE_CLASS_NAME}>
            <Badge tone="accent">{item.badge}</Badge>
          </span>
        ) : null}
      </span>
      <span className={RAIL_LABEL_CLASS_NAME}>
        <Text size="xs" weight={item.isActive || item.isPrimary ? "semibold" : "medium"} tone={item.isPrimary ? "accent" : item.isActive ? "default" : "muted"}>
          {item.label}
        </Text>
      </span>
    </Link>
  );
};

/** Phone-only "More" tab: the destinations that don't fit the bottom bar. */
const PhoneMore = ({ items }: { readonly items: ReadonlyArray<ConsoleShellNavItem> }) => {
  const t = useT(shellDict);
  const [isOpen, setOpen] = useState(false);
  const isActive = items.some((item) => item.isActive);
  return (
    <div className={PHONE_ONLY_CLASS_NAME}>
      <Popover
        isOpen={isOpen}
        onOpenChange={setOpen}
        placement="top"
        title={t("navMore")}
        trigger={
          <button type="button" className={`${RAIL_ITEM_CLASS_NAME}${isActive ? ` ${RAIL_ITEM_ACTIVE_CLASS_NAME}` : ""}`} aria-label={t("navMore")}>
            <span className={`${RAIL_GLYPH_CLASS_NAME} ${isActive ? RAIL_GLYPH_ACTIVE_CLASS_NAME : RAIL_GLYPH_MUTED_CLASS_NAME}`}>
              <NivoIcon props={{ name: "apps", usage: "leading" }} />
            </span>
            <span className={RAIL_LABEL_CLASS_NAME}>
              <Text size="xs" weight={isActive ? "semibold" : "medium"} tone={isActive ? "default" : "muted"}>
                {t("navMore")}
              </Text>
            </span>
          </button>
        }
      >
        <div className={NOTIFY_LIST_CLASS_NAME}>
          {items.map((item) => (
            <Link key={item.id} href={item.href} className={NOTIFY_ITEM_CLASS_NAME} aria-current={item.isActive ? "page" : undefined} onClick={() => setOpen(false)}>
              <Text weight={item.isActive ? "semibold" : "medium"}>{item.label}</Text>
            </Link>
          ))}
        </div>
      </Popover>
    </div>
  );
};

type ShellPartProps = { readonly data: ConsoleShellBaseData; readonly on: ConsoleShellBaseActions };

const UserMenu = ({ data, on }: ShellPartProps) => {
  const t = useT(shellDict);
  const entries: ReadonlyArray<DropdownMenuEntry> = [
    {
      kind: "section",
      id: "account",
      label: data.userName,
      items: [
        { id: "email", label: data.email || t("signedIn"), isDisabled: true },
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
        <div className={BELL_WRAP_CLASS_NAME}>
          <IconButton
            source={nivoIconSource("notification", "leading")}
            label={count === 0 ? t("notifications") : t("pendingLabel", { count })}
          />
          {count > 0 ? (
            <span className={BELL_COUNT_CLASS_NAME}>
              <Badge tone="accent">{count}</Badge>
            </span>
          ) : null}
        </div>
      }
    >
      <div className={NOTIFY_PANEL_CLASS_NAME}>
        {count === 0 ? (
          <Text tone="muted" size="sm">
            {t("nothingWaiting")}
          </Text>
        ) : (
          <div className={NOTIFY_LIST_CLASS_NAME}>
            {data.pending.slice(0, 5).map((item) => (
              <Link key={item.id} href={item.href} className={NOTIFY_ITEM_CLASS_NAME} onClick={() => setOpen(false)}>
                <Text weight="medium" overflow="truncate">
                  {item.leadName}
                </Text>
                <Text size="sm" tone="muted" overflow="clamp-2">
                  {item.summary}
                </Text>
              </Link>
            ))}
          </div>
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
    <div className={ROOT_CLASS_NAME}>
      <nav className={RAIL_CLASS_NAME} aria-label={t("mainNavigation")}>
        <div className={RAIL_LOGO_CLASS_NAME}>
          <NivoLogo variant="mark" height={32} />
        </div>
        <div className={RAIL_NAV_CLASS_NAME}>
          {data.nav.map((item) => (
            <RailItem key={item.id} item={item} phoneHidden={!PHONE_TABS.has(item.id)} />
          ))}
          <PhoneMore items={data.nav.filter((item) => !PHONE_TABS.has(item.id))} />
        </div>
        <div className={RAIL_SPACER_CLASS_NAME} />
        <div className={RAIL_USER_CLASS_NAME}>
          <UserMenu data={data} on={on} />
        </div>
      </nav>
      <div className={COLUMN_CLASS_NAME}>
        <header className={TOPBAR_CLASS_NAME}>
          <div className={TOPBAR_IDENTITY_CLASS_NAME}>
            <span className={TOPBAR_MARK_CLASS_NAME}>
              <NivoLogo variant="mark" height={28} />
            </span>
            <div className={WORKSPACE_NAME_CLASS_NAME}>
              <Text weight="semibold" overflow="truncate">
                {data.workspaceName}
              </Text>
            </div>
            <div className={BADGE_CLASS_NAME}>
              <FoundingBadge isFoundingMember={data.isFoundingMember} />
            </div>
          </div>
          <div className={TOPBAR_SPACER_CLASS_NAME} />
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
          <div className={ACTIONS_CLASS_NAME}>
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
            <span className={TOPBAR_USER_CLASS_NAME}>
              <UserMenu data={data} on={on} />
            </span>
          </div>
        </header>
        <main className={MAIN_CLASS_NAME} aria-label={t("groupWorkspace")}>
          {children}
          {isFullHeight ? null : <div className={PAGE_END_SPACER_CLASS_NAME} aria-hidden="true" />}
        </main>
        {data.strip}
      </div>
    </div>
  );
};

/** Draw the console chrome (Zalo-style rail, light top bar, one optional strip) around the routed page. */
export const ConsoleShellBase = (props: ConsoleShellBaseProps) => (
  <StarCiDashboardThemeBoundary content={Frame} contentProps={{ shell: props }} />
);
