import "server-only";
import type { Connector, DataProvider } from "../data-hub";
import { connector as openapi } from "./openapi";
import { connector as database } from "./database";
import { connector as csvImport } from "./csv-import";
import { connector as imap } from "./imap";
import { connector as telegramUser } from "./telegram-user";

/** Every data connector, by provider. Each file owns its provider; nothing else changes when one is built out. */
export const CONNECTORS: Readonly<Record<DataProvider, Connector>> = {
  openapi,
  database,
  csv_import: csvImport,
  imap,
  telegram_user: telegramUser,
};
