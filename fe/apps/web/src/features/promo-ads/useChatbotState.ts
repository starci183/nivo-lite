"use client"

import { useEffect, useState } from "react"
import { readChatbotState } from "./actions"
import type { ChatbotState } from "./queries"

/** Reads the real chatbot state once on mount; null until known. */
export const useChatbotState = (): ChatbotState | null => {
  const [state, setState] = useState<ChatbotState | null>(null)
  useEffect(() => {
    let cancelled = false
    void readChatbotState().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
