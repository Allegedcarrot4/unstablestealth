-- Add columns for soft delete and personal hide functionality
ALTER TABLE public.chat_messages 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN deleted_by UUID DEFAULT NULL,
ADD COLUMN hidden_for_session_ids UUID[] DEFAULT '{}';

-- Add foreign key for deleted_by
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_deleted_by_fkey 
FOREIGN KEY (deleted_by) REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Create index for efficient filtering of non-deleted messages
CREATE INDEX idx_chat_messages_deleted_at ON public.chat_messages(deleted_at);