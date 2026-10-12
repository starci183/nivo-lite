// PORTED from src/lib/knowledge/extract.ts (keep in sync by hand). Only difference: no "server-only" import (the engine is all server).

export type TextKind = "text" | "pdf" | "docx" | "xlsx" | "pptx";

/** Kind of an uploaded file by name (the old file path took only .txt/.md; PDF, Word and CSV are added with the batch flow). */
export const fileTextKind = (name: string): TextKind | null => {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : ext === "xlsx" ? "xlsx" : ext === "pptx" ? "pptx" : ext === "txt" || ext === "md" || ext === "markdown" || ext === "csv" ? "text" : null;
};

/** Kind of a downloaded body: magic bytes first, then content type. null = not a type we can read. */
export const sniffTextKind = (bytes: Uint8Array, contentType: string): TextKind | null => {
  if (String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-") return "pdf";
  if (/wordprocessingml/i.test(contentType)) return "docx";
  if (/spreadsheetml/i.test(contentType)) return "xlsx";
  if (/presentationml/i.test(contentType)) return "pptx";
  if (/^text\/(?!html)|csv|json|markdown|xml/i.test(contentType)) return "text";
  return null;
};

const decode = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
};

/** Plain text of a file's bytes. Throws a short Vietnamese reason when the file cannot be read. */
export const textFromBytes = async (kind: TextKind, bytes: Uint8Array): Promise<string> => {
  if (kind === "text") {
    if (bytes.subarray(0, 4096).includes(0) && !(bytes[0] === 0xff || bytes[0] === 0xfe)) throw new Error("Không phải tệp văn bản.");
    return decode(bytes);
  }
  if (kind === "docx") {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error("Tệp .docx không hợp lệ.");
    try {
      const mammoth = await import("mammoth");
      return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } catch { throw new Error("Không đọc được tệp Word này."); }
  }
  if (kind === "xlsx" || kind === "pptx") {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error(`Tệp .${kind} không hợp lệ.`);
    try {
      const { pptxToText, xlsxToText } = await import("./ooxml");
      return kind === "xlsx" ? xlsxToText(bytes) : pptxToText(bytes);
    } catch { throw new Error(kind === "xlsx" ? "Không đọc được tệp Excel này." : "Không đọc được tệp PowerPoint này."); }
  }
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new Error("Tệp PDF không hợp lệ.");
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    return (await extractText(pdf, { mergePages: true })).text;
  } catch { throw new Error("Không đọc được tệp PDF này (có thể bị khóa hoặc chỉ là ảnh quét)."); }
};
