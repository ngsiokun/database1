-- Create members table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  tel TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  keyword TEXT DEFAULT '',
  title TEXT DEFAULT '',
  ig_link TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Users can only view their own data
CREATE POLICY "Users can view own member data"
ON public.members FOR SELECT
USING (auth.uid() = user_id);

-- Users can only update their own data
CREATE POLICY "Users can update own member data"
ON public.members FOR UPDATE
USING (auth.uid() = user_id);

-- Users can insert their own data
CREATE POLICY "Users can insert own member data"
ON public.members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Auto update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_updated_at
BEFORE UPDATE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto create member record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.members (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_member
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_member();