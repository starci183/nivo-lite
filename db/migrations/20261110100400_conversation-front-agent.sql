-- One customer, two agents: a conversation remembers the agent that opened the door (`front_agent_id`) while `agent_id` stays the
-- agent that speaks. The first hand-over fills it (COALESCE keeps the first front agent on a second hand-over); a hand-back after a won
-- deal returns the conversation to it. Expand only: the column is nullable, no row changes, an old reader never selects it.

ALTER TABLE public.agent_conversations
    ADD COLUMN front_agent_id uuid;

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_front_agent_id_fkey FOREIGN KEY (front_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX agent_conversations_front_agent
    ON public.agent_conversations USING btree (workspace_id, front_agent_id)
    WHERE (front_agent_id IS NOT NULL);

-- The consumer queue of the conversation_handback reactor (be/src/features/reactors/conversation-handback): a won deal returns the
-- conversation to the agent that opened it. The queue, its dead-letter queue and its topic binding follow event-bus.queue.ts; every
-- call is idempotent.

select pgmq.create('deal_won__conversation_handback');
select pgmq.create('deal_won__conversation_handback__dead');
select pgmq.bind_topic('deal_won', 'deal_won__conversation_handback');
