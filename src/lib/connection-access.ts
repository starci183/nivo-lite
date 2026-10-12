/**
 * Client-safe rules of agent access to connections: the three access levels and which agent (by its module) may use which
 * provider, and for what. The server (connection-actions.ts) and both pickers (a connection's agents, an agent's connections)
 * read the same table, so the two directions always agree.
 */

/** What an agent may do through one connection. */
export type Access = "read" | "ask" | "auto";

/** Lowest to highest. A new grant starts at `ask`; `auto` is never a default. */
export const ACCESS_LEVELS: ReadonlyArray<Access> = ["read", "ask", "auto"];
export const DEFAULT_ACCESS: Access = "ask";

export const isAccess = (v: unknown): v is Access => v === "read" || v === "ask" || v === "auto";

/** How an agent uses a connection (stored on the grant). */
export type Purpose = "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source";

/** module:provider -> purpose. A pair that is not listed cannot be granted (the picker shows it disabled with the reason). */
const PURPOSE: Readonly<Record<string, Purpose>> = {
  "chatbot:telegram": "inbound_chat",
  "chatbot:zalo_oa": "inbound_chat",
  // Booking and Loyalty can also listen on a chat connection (the chatbot stays the front door and hands over by intent: lib/agent-bindings routeInbound).
  "booking:telegram": "inbound_chat",
  "booking:zalo_oa": "inbound_chat",
  "loyalty:telegram": "inbound_chat",
  "loyalty:zalo_oa": "inbound_chat",
  // Facebook Pages + Instagram (meta): DMs, comments and mentions reach the same front doors; lead ads (leadgen) go to the lead sources.
  "chatbot:meta": "inbound_chat",
  "booking:meta": "inbound_chat",
  "loyalty:meta": "inbound_chat",
  "lead_gen:meta": "lead_source",
  "sales:meta": "lead_source",
  // Shifts speaks to staff only through the connections bound to it; none bound = Office only.
  "shifts:telegram": "outbound_chat",
  "shifts:zalo_oa": "outbound_chat",
  "sales:telegram": "outbound_chat",
  "sales:zalo_oa": "outbound_chat",
  "accounting:sepay": "bank_feed",
  "accounting:payos": "bank_feed",
  "accounting:casso": "bank_feed",
};

/** Data connectors every agent may read from (a database, an API, an import, a mailbox, a personal Telegram). */
const DATA_PROVIDERS: ReadonlySet<string> = new Set(["database", "openapi", "csv_import", "imap", "telegram_user"]);

/** True for the providers every agent may read from (data connectors), whatever its module. */
export const isDataProvider = (provider: string): boolean => DATA_PROVIDERS.has(provider);

/** The purpose a grant of `provider` to an agent of `module` has, or null when that agent cannot use that provider. */
export const purposeFor = (module: string, provider: string): Purpose | null => {
  const direct = PURPOSE[`${module}:${provider}`];
  if (direct) return direct;
  if (DATA_PROVIDERS.has(provider)) return provider === "openapi" ? "tool" : "data_source";
  return null;
};

/** One agent's access to one connection, as both pickers show it (null = no access). */
export type Grant = { readonly agentId: string; readonly connectionId: string; readonly access: Access };
