-- 1. Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Comment Reactions table
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  UNIQUE(comment_id, user_id, emoji)
);

-- RLS Policies
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Comments: Read access (If prompt is public or it's your own prompt)
CREATE POLICY "Users can read comments of accessible prompts" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.prompts
      WHERE prompts.id = comments.prompt_id
      AND (prompts.is_public = true OR prompts.user_id = auth.uid())
    )
  );

-- Comments: Insert access (Logged in users)
CREATE POLICY "Users can insert their own comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comments: Delete access (Own comments)
CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- Reactions: Read access
CREATE POLICY "Users can read reactions" ON public.comment_reactions
  FOR SELECT USING (true);

-- Reactions: Insert/Delete access (Own reactions)
CREATE POLICY "Users can manage their own reactions" ON public.comment_reactions
  FOR ALL USING (auth.uid() = user_id);

-- Realtime: Enable for comments and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;
