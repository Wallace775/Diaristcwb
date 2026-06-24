-- ============================================================
-- POLÍTICAS RLS (Row Level Security) — DiaristCWB
-- Pode executar o script inteiro quantas vezes quiser,
-- pois cada CREATE POLICY é precedido de DROP POLICY IF EXISTS.
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de perfis autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir insercao de perfil proprio" ON public.profiles;
DROP POLICY IF EXISTS "Permitir atualizacao de perfil proprio" ON public.profiles;
DROP POLICY IF EXISTS "Permitir exclusao de perfil proprio" ON public.profiles;

CREATE POLICY "Permitir leitura de perfis autenticados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insercao de perfil proprio"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir atualizacao de perfil proprio"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Permitir exclusao de perfil proprio"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);


-- ============================================================
-- 2. ADDRESSES
-- ============================================================

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de enderecos autenticados" ON public.addresses;
DROP POLICY IF EXISTS "Permitir insercao de endereco proprio" ON public.addresses;
DROP POLICY IF EXISTS "Permitir atualizacao de endereco proprio" ON public.addresses;
DROP POLICY IF EXISTS "Permitir exclusao de endereco proprio" ON public.addresses;

CREATE POLICY "Permitir leitura de enderecos autenticados"
  ON public.addresses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insercao de endereco proprio"
  ON public.addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Permitir atualizacao de endereco proprio"
  ON public.addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Permitir exclusao de endereco proprio"
  ON public.addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);


-- ============================================================
-- 3. CONNECTIONS
-- ============================================================

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de conexoes proprias" ON public.connections;
DROP POLICY IF EXISTS "Permitir insercao de conexao como cliente" ON public.connections;
DROP POLICY IF EXISTS "Permitir atualizacao de conexoes proprias" ON public.connections;
DROP POLICY IF EXISTS "Permitir exclusao de conexoes proprias" ON public.connections;

CREATE POLICY "Permitir leitura de conexoes proprias"
  ON public.connections FOR SELECT
  TO authenticated
  USING (
    auth.uid() = cliente_id OR
    auth.uid() = diarista_id
  );

CREATE POLICY "Permitir insercao de conexao como cliente"
  ON public.connections FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "Permitir atualizacao de conexoes proprias"
  ON public.connections FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = cliente_id OR
    auth.uid() = diarista_id
  );

CREATE POLICY "Permitir exclusao de conexoes proprias"
  ON public.connections FOR DELETE
  TO authenticated
  USING (
    auth.uid() = cliente_id OR
    auth.uid() = diarista_id
  );


-- ============================================================
-- 4. BOOKINGS (Corrigido para cliente_id em português)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.profiles(id) NOT NULL,
  diarista_id UUID REFERENCES public.profiles(id) NOT NULL,
  address_id UUID REFERENCES public.addresses(id) NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  estimated_hours INTEGER DEFAULT 4,
  property_size_category TEXT DEFAULT 'medium',
  observations TEXT,
  total_price DECIMAL(10,2) NOT NULL,
  diarista_cut DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garante que a coluna address_id exista (para tabelas criadas antes desta atualizacao)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES public.addresses(id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de bookings proprios" ON public.bookings;
DROP POLICY IF EXISTS "Permitir insercao de booking como cliente" ON public.bookings;
DROP POLICY IF EXISTS "Permitir atualizacao de bookings proprios" ON public.bookings;

CREATE POLICY "Permitir leitura de bookings proprios"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = cliente_id OR
    auth.uid() = diarista_id
  );

CREATE POLICY "Permitir insercao de booking como cliente"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "Permitir atualizacao de bookings proprios"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = cliente_id OR
    auth.uid() = diarista_id
  );


-- ============================================================
-- 5. REVIEWS (Corrigido usando a estrutura real do seu Table Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  evaluator_id UUID REFERENCES public.profiles(id),
  evaluated_id UUID REFERENCES public.profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de reviews" ON public.reviews;
DROP POLICY IF EXISTS "Permitir insercao de review como cliente" ON public.reviews;

CREATE POLICY "Permitir leitura de reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insercao de review como cliente"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = evaluator_id);