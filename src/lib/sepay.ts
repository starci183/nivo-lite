import { timingSafeEqual } from "node:crypto";

/**
 * SePay helpers (https://docs.sepay.vn): webhook auth, payload shape, order codes and the VietQR image URL.
 * Pure (no database), so it is cheap to reason about and to check.
 */

/** The webhook body SePay POSTs for every bank transaction (field names exactly as in SePay's docs). */
export type SepayPayload = {
  id: number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content?: string | null;
  transferType?: string;
  description?: string | null;
  transferAmount?: number;
  accumulated?: number;
  referenceCode?: string | null;
};

/** Order codes: "NIVO" + 5 characters from an alphabet without 0/O/1/I/L (easy to read out and to type). */
export const ORDER_PREFIX = "NIVO";
const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ORDER_LENGTH = 5;

export const newOrderCode = (): string => {
  const bytes = new Uint8Array(ORDER_LENGTH);
  crypto.getRandomValues(bytes);
  return ORDER_PREFIX + Array.from(bytes, (b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]).join("");
};

/**
 * Every order code a transfer text might name. Banks drop or add spaces and dashes and change case
 * ("nivo 8f3k2 - chuyen tien"), so the text is compared upper-cased with only letters and digits kept.
 */
export const orderCodesIn = (...texts: Array<string | null | undefined>): Array<string> => {
  const found = new Set<string>();
  const pattern = new RegExp(`${ORDER_PREFIX}([${ORDER_ALPHABET}]{${ORDER_LENGTH}})`, "g");
  for (const text of texts) {
    const compact = (text ?? "").normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]/g, "");
    for (let i = compact.indexOf(ORDER_PREFIX); i >= 0; i = compact.indexOf(ORDER_PREFIX, i + 1)) {
      pattern.lastIndex = i;
      const m = pattern.exec(compact);
      if (m && m.index === i) found.add(m[0]);
    }
  }
  return [...found];
};

/** `Authorization: Apikey <key>` against the configured key, in constant time. */
export const isValidApiKey = (header: string | null, expected: string | undefined): boolean => {
  if (!expected || !header) return false;
  const m = header.match(/^\s*Apikey\s+(.+?)\s*$/i);
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** The bank account customers pay into (env; placeholders until the owner connects SePay). */
export const bankAccount = () => ({
  account: process.env.SEPAY_BANK_ACCOUNT ?? "",
  bank: process.env.SEPAY_BANK_CODE ?? "",
  holder: process.env.SEPAY_ACCOUNT_NAME ?? "",
});

/** SePay's VietQR image: https://qr.sepay.vn/img?acc=…&bank=…&amount=…&des=… */
export const qrImageUrl = (amount: number, orderCode: string): string => {
  const { account, bank } = bankAccount();
  const q = new URLSearchParams({ acc: account, bank, amount: String(amount), des: orderCode, template: "compact" });
  return `https://qr.sepay.vn/img?${q.toString()}`;
};
