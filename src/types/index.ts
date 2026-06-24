export type UserType = 'cliente' | 'diarista';

export interface UserSession {
  loggedIn: boolean;
  type: UserType | null;
}

export interface DiaristaItem {
  id: string;
  full_name: string;
  phone: string;
  price: number;
  bairro: string;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  seniority: string | null;
  specialties: string[];
  experience_years: number | null;
  profile_verified: boolean;
}

export type SeniorityLevel = 'learning' | 'advanced' | 'expert';

export const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string; description: string }[] = [
  { value: 'learning', label: 'Iniciante', description: 'Em desenvolvimento, primeiras experiências' },
  { value: 'advanced', label: 'Avançado', description: 'Profissional com boas referências e prática consolidada' },
  { value: 'expert', label: 'Especialista', description: 'Expertise comprovada, anos de mercado e alta demanda' },
];

export const SPECIALTY_OPTIONS = [
  'Limpeza Pesada',
  'Limpeza Comercial',
  'Passar Roupa',
  'Organização',
  'Higienização Pós-Obra',
  'Limpeza de Vidros',
  'Cuidados com Idosos',
  'Cozinha e Alimentação',
  'Faxina Semanal',
];

export interface Bairro {
  name: string;
  latitude: number;
  longitude: number;
}

export interface AddressRecord {
  id: string;
  profile_id: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

export interface ConnectionRecord {
  id: string;
  cliente_id: string;
  diarista_id: string;
  created_at: string;
}

export interface ConnectionWithProfile extends ConnectionRecord {
  profile: {
    full_name: string;
    phone: string;
    avatar_url: string | null;
  };
}

export interface BookingRecord {
  id: string;
  client_id: string;
  diarista_id: string;
  address_id: string;
  scheduled_date: string;
  estimated_hours: number;
  property_size_category: string;
  observations: string | null;
  total_price: number;
  diarista_cut: number;
  platform_fee: number;
  status: string;
  payment_status: string;
  created_at: string;
  completed_at?: string | null;
}

export interface FavoriteRecord {
  id: string;
  client_id: string;
  diarista_id: string;
  created_at: string;
}

export interface ReviewRecord {
  id: string;
  booking_id: string;
  evaluator_id: string;
  evaluated_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}
