import "server-only"
import type { RecordInput } from "@/lib/data-hub"
import { CsvError, assertSize, decodeText } from "./table"
import { MAX_DOC_TEXT } from "./types"

const clip = (text: string) => {
  const t = text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim()
  return t.length > MAX_DOC_TEXT ? { text: t.slice(0, MAX_DOC_TEXT), truncated: true } : { text: t, truncated: false }
}

/** First heading ("# Title") or first non-empty line, else the fallback. */
const titleFrom = (text: string, fallback: string): string => {
  const heading = text.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1]
  const line = heading ?? text.split("\n").find((l) => l.trim())
  return (line ?? fallback).trim().replace(/^#+\s*/, "").slice(0, 120) || fallback
}

export const docKind = (name: string): "docx" | "pdf" | "text" | null => {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return ext === "docx" ? "docx" : ext === "pdf" ? "pdf" : ext === "txt" || ext === "md" ? "text" : null
}

/** One uploaded document -> one hub row (entity `document`); externalId = file name, so the same name replaces it. */
export const recordFromDocument = async (name: string, bytes: Uint8Array): Promise<RecordInput> => {
  const label = name.replace(/^.*[\\/]/, "").slice(0, 80)
  assertSize(bytes)
  const kind = docKind(name)
  if (!kind) throw new CsvError(`${label}: chỉ nhận .docx, .pdf, .txt hoặc .md.`)
  let raw = ""
  let pages: number | undefined
  if (kind === "text") {
    if (bytes.subarray(0, 4096).includes(0) && !(bytes[0] === 0xff || bytes[0] === 0xfe)) throw new CsvError(`${label}: không phải file văn bản.`)
    raw = decodeText(bytes)
  } else if (kind === "docx") {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new CsvError(`${label}: file .docx không hợp lệ.`)
    try {
      const mammoth = await import("mammoth")
      raw = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value
    } catch {
      throw new CsvError(`${label}: không đọc được file Word này.`)
    }
  } else {
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new CsvError(`${label}: file PDF không hợp lệ.`)
    try {
      const { extractText, getDocumentProxy } = await import("unpdf")
      const pdf = await getDocumentProxy(new Uint8Array(bytes))
      const out = await extractText(pdf, { mergePages: true })
      raw = out.text
      pages = out.totalPages
    } catch {
      throw new CsvError(`${label}: không đọc được file PDF này (file có thể bị khóa hoặc chỉ là ảnh quét).`)
    }
  }
  const { text, truncated } = clip(raw)
  if (!text) throw new CsvError(`${label}: không có chữ nào để đọc.`)
  const base = name.replace(/^.*[\\/]/, "").slice(0, 300)
  return {
    externalId: base,
    title: titleFrom(text, base),
    data: { text, source: "upload", fileName: base, ...(pages ? { pages } : {}), ...(truncated ? { truncated: true } : {}) },
  }
}

/** A Google Docs text export -> one hub row. */
export const recordFromGoogleDoc = (docId: string, raw: string): RecordInput => {
  const { text, truncated } = clip(raw.replace(/^﻿/, ""))
  if (!text) throw new CsvError("Tài liệu Google Docs này đang trống.")
  return { externalId: docId, title: titleFrom(text, `Google Docs ${docId.slice(0, 8)}`), data: { text, source: "google_docs", docId, ...(truncated ? { truncated: true } : {}) } }
}
