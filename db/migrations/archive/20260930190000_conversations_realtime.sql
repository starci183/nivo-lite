-- New customer conversations from real channels (Telegram) appear live in the Chatbot page.
alter publication supabase_realtime add table public.agent_conversations;
