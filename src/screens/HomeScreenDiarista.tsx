import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MapPin, User, Phone, Save, ArrowLeft, Camera, Users, Sun, Moon, Calendar, MessageCircle, CheckCircle, HelpCircle, XCircle, History } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import { Bairro, ConnectionRecord, ConnectionWithProfile, BookingRecord } from '../types';
import { maskPhone, maskPrice, formatCurrency, formatDisplayName } from '../utils/masks';
import { uploadAvatar } from '../utils/storage';
import { GOOGLE_PLACES_API_KEY } from '../config/google';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import UserAvatar from '../components/UserAvatar';
import SenioritySelector from '../components/SenioritySelector';
import VerifiedBadge from '../components/VerifiedBadge';
import { SeniorityLevel } from '../types';

interface BookingWithClient extends BookingRecord {
  client: {
    full_name: string;
    phone: string;
    avatar_url: string | null;
  };
}

interface Props {
  onLogout: () => void;
}

export default function HomeScreenDiarista({ onLogout }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [preco, setPreco] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [bairroSelecionado, setBairroSelecionado] = useState<Bairro | null>(null);
  const [step, setStep] = useState<'profile' | 'address'>('profile');
  const [hasAddress, setHasAddress] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [seniority, setSeniority] = useState<SeniorityLevel | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState<number | null>(null);
  const [profileVerified, setProfileVerified] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'pedidos' | 'agenda'>('profile');
  const [bookings, setBookings] = useState<BookingWithClient[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null);
  const [confirmedBookings, setConfirmedBookings] = useState<BookingWithClient[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myReviews, setMyReviews] = useState<{ client_name: string; rating: number; comment: string | null; created_at: string }[]>([]);
  const [loadingMyReviews, setLoadingMyReviews] = useState(false);
  const [showMyReviews, setShowMyReviews] = useState(false);
  const [agendaSubTab, setAgendaSubTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [completedBookings, setCompletedBookings] = useState<BookingWithClient[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<BookingWithClient[]>([]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), carregarInteressados(), carregarAgenda(), loadSummary()]);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadProfile();
    loadSummary();
    carregarAgenda();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, price, avatar_url, bio, birth_date, seniority, specialties, experience_years')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setPreco(profile.price ? Math.round(profile.price * 100).toString() : '');
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        setBio(profile.bio || '');
        setBirthDate(profile.birth_date
          ? (() => {
              const iso = profile.birth_date.replace(/[-]/g, '/');
              const partes = iso.split('/');
              if (partes.length === 3 && partes[0].length === 4) {
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
              }
              return profile.birth_date;
            })()
          : '');
        setSeniority(profile.seniority as SeniorityLevel | null || null);
        setSpecialties(profile.specialties || []);
        setExperienceYears(profile.experience_years || null);
      }

      const { data: address } = await supabase
        .from('addresses')
        .select('neighborhood, latitude, longitude')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (address) {
        setHasAddress(true);
        setBairroSelecionado({
          name: address.neighborhood,
          latitude: address.latitude,
          longitude: address.longitude,
        });
      }
    } catch (error: any) {
      Alert.alert("Erro", "Não foi possível carregar seu perfil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const complete =
      !!fullName.trim() &&
      !!phone.trim() &&
      !!avatarUrl &&
      !!bio.trim() &&
      !!birthDate.trim() &&
      !!preco &&
      !!bairroSelecionado &&
      !!seniority &&
      specialties.length > 0;
    setProfileVerified(complete);
  }, [fullName, phone, avatarUrl, bio, birthDate, preco, bairroSelecionado, seniority, specialties]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: all } = await supabase
        .from('bookings')
        .select('status, total_price')
        .eq('diarista_id', user.id);

      if (!all) { setTotalEarnings(0); setConfirmedCount(0); return; }

      const earnings = all
        .filter((b) => b.status === 'completed')
        .reduce((sum, b) => sum + Number(b.total_price), 0);

      const confirmed = all.filter((b) => b.status === 'accepted').length;

      setTotalEarnings(earnings);
      setConfirmedCount(confirmed);
    } catch {
      setTotalEarnings(0);
      setConfirmedCount(0);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleCompleteBooking = async (booking: BookingWithClient) => {
    setUpdatingBooking(booking.id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed', completed_at: now })
        .eq('id', booking.id);

      if (error) throw error;

      const scheduled = new Date(booking.scheduled_date);
      const completed = new Date(now);
      const diffMs = completed.getTime() - scheduled.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMinutes = Math.floor((diffMs % 3600000) / 60000);

      let tempoDecorrido = '';
      if (diffHours > 0) tempoDecorrido += `${diffHours}h`;
      if (diffMinutes > 0) tempoDecorrido += `${diffMinutes}m`;
      if (!tempoDecorrido) tempoDecorrido = '0m';

      Alert.alert(
        "Faxina concluída!",
        `Faxina concluída com sucesso em ${tempoDecorrido}!`
      );

      carregarAgenda();
      loadSummary();
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível finalizar a faxina.");
    } finally {
      setUpdatingBooking(null);
    }
  };

  const loadMyReviews = async () => {
    setLoadingMyReviews(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('reviews')
        .select('rating, comment, created_at, evaluator_id')
        .eq('evaluated_id', user.id)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const clientIds = [...new Set(data.map((r) => r.evaluator_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', clientIds);

        const mapped = data.map((r) => ({
          client_name: formatDisplayName(profiles?.find((p) => p.id === r.evaluator_id)?.full_name || '') || 'Cliente',
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
        }));
        setMyReviews(mapped);
      } else {
        setMyReviews([]);
      }
    } catch {
      setMyReviews([]);
    } finally {
      setLoadingMyReviews(false);
    }
  };

  const propertySizeLabel = (category: string): string => {
    const map: Record<string, string> = {
      small: 'Pequeno',
      medium: 'Médio',
      large: 'Grande',
    };
    return map[category] || category;
  };

  const formatBookingDateTime = (scheduledDate: string, estimatedHours: number): string => {
    const date = new Date(scheduledDate);
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    const weekday = weekdays[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const startHour = date.getHours();
    const startMinutes = date.getMinutes();
    const endHour = startHour + estimatedHours;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const periodo = startHour < 12 ? 'Manhã' : startHour < 18 ? 'Tarde' : 'Noite';
    return `${weekday}, ${day} De ${month} ${pad(startHour)}:${pad(startMinutes)} às ${pad(endHour)}:${pad(startMinutes)} (${periodo})`;
  };

  const carregarAgenda = async () => {
    setLoadingAgenda(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('bookings')
        .select('*, client:client_id(full_name, phone, avatar_url)')
        .eq('diarista_id', user.id)
        .in('status', ['accepted', 'completed', 'cancelled'])
        .order('scheduled_date', { ascending: true });

      if (data) {
        const all = data as BookingWithClient[];
        setConfirmedBookings(all.filter((b) => b.status === 'accepted'));

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        setCompletedBookings(all.filter((b) => {
          if (b.status !== 'completed') return false;
          const d = new Date(b.scheduled_date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }));

        setCancelledBookings(all.filter((b) => b.status === 'cancelled'));
      }
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível carregar a agenda.");
      setConfirmedBookings([]);
      setCompletedBookings([]);
      setCancelledBookings([]);
    } finally {
      setLoadingAgenda(false);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Precisamos de acesso à sua galeria.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const url = await uploadAvatar(user.id, result.assets[0].uri);
      if (url) {
        setAvatarUrl(url);
      }
    } catch {
      // fallback silencioso — UserAvatar já exibe iniciais
    } finally {
      setUploadingAvatar(false);
    }
  };

  const carregarInteressados = async () => {
    setLoadingBookings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bks } = await supabase
        .from('bookings')
        .select('*')
        .eq('diarista_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!bks || bks.length === 0) {
        setBookings([]);
        return;
      }

      const clientIds = [...new Set(bks.map((b) => b.client_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', clientIds);

      const mapped: BookingWithClient[] = bks.map((b) => ({
        ...b,
        client: {
          full_name: profiles?.find((p) => p.id === b.client_id)?.full_name || 'Cliente',
          phone: profiles?.find((p) => p.id === b.client_id)?.phone || '',
          avatar_url: profiles?.find((p) => p.id === b.client_id)?.avatar_url || null,
        },
      }));

      setBookings(mapped);
    } catch (error: any) {
      Alert.alert("Erro", error?.message || "Não foi possível carregar os pedidos.");
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    setUpdatingBooking(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'accepted' })
        .eq('id', bookingId);

      if (error) throw error;

      Alert.alert("Solicitação aceita!", "Você confirmou o agendamento.");
      carregarInteressados();
      carregarAgenda();
      loadSummary();
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível aceitar a solicitação.");
    } finally {
      setUpdatingBooking(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setUpdatingBooking(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;

      Alert.alert("Solicitação cancelada", "O pedido foi cancelado.");
      carregarInteressados();
      carregarAgenda();
      loadSummary();
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível cancelar a solicitação.");
    } finally {
      setUpdatingBooking(null);
    }
  };

  const handleTabChange = (tab: 'profile' | 'pedidos' | 'agenda') => {
    setActiveTab(tab);
    if (tab === 'pedidos') {
      carregarInteressados();
    } else if (tab === 'agenda') {
      carregarAgenda();
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert("Atenção", "Nome e telefone são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          price: preco ? Number(preco) / 100 : null,
          avatar_url: avatarUrl,
          bio: bio.trim() || null,
          birth_date: (() => {
            const raw = birthDate.trim();
            if (!raw) return null;
            const partes = raw.split('/');
            if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
            return raw;
          })(),
          seniority: seniority || null,
          specialties: specialties.length > 0 ? specialties : null,
          experience_years: experienceYears,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      Alert.alert("Sucesso!", "Perfil atualizado.");
      setStep('address');
    } catch (error: any) {
      Alert.alert("Erro ao salvar", error.message || "Não foi possível atualizar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!bairroSelecionado) {
      Alert.alert("Atenção", "Selecione um bairro.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existing } = await supabase
        .from('addresses')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('addresses')
          .update({
            profile_id: user.id,
            neighborhood: bairroSelecionado.name,
            latitude: bairroSelecionado.latitude,
            longitude: bairroSelecionado.longitude,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert({
            profile_id: user.id,
            neighborhood: bairroSelecionado.name,
            latitude: bairroSelecionado.latitude,
            longitude: bairroSelecionado.longitude,
          });

        if (error) throw error;
      }

      setHasAddress(true);
      Alert.alert("Sucesso!", "Endereço salvo. Agora você aparece na busca dos clientes!");
    } catch (error: any) {
      Alert.alert("Erro ao salvar endereço", error.message || "Não foi possível salvar o endereço.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textGray }]}>Carregando seu perfil...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
        {uploadingAvatar ? (
          <View style={[styles.avatarHeader, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : (
          <UserAvatar
            url={avatarUrl}
            name={fullName || 'Diarista'}
            size={44}
            onPress={handlePickAvatar}
          />
        )}
        <View style={styles.headerCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.headerGreeting, { color: theme.textDark }]}>Olá, {formatDisplayName(fullName) || 'Diarista'}!</Text>
            {profileVerified && <VerifiedBadge size={16} />}
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textGray }]}>Painel da Diarista</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}>
            {isDark ? <Sun color={theme.textDark} size={20} /> : <Moon color={theme.textDark} size={20} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.dangerBg }]} onPress={onLogout}>
            <Text style={[styles.logoutText, { color: theme.danger }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        {loadingSummary ? (
          <>
            <View style={[styles.summaryCardSkeleton, { backgroundColor: theme.white }]}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
            <View style={[styles.summaryCardSkeleton, { backgroundColor: theme.white }]}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={styles.summaryIcon}>💰</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.summaryLabel, { color: '#166534' }]}>Ganhos do Mês</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    "Como funcionam seus ganhos",
                    "O DiaristCWB é 100% gratuito para você! Não retemos nenhuma taxa sobre suas faxinas concluídas. Todo o valor do serviço combinado diretamente com o cliente vai integralmente (100%) para você. Nosso objetivo é conectar você a bons clientes na sua região sem intermediários!"
                  )}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <HelpCircle size={14} color="#166534" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.summaryValue, { color: '#15803d' }]}>
                {totalEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
              <Text style={styles.summaryIcon}>📅</Text>
              <Text style={[styles.summaryLabel, { color: '#1e40af' }]}>Confirmadas</Text>
              <Text style={[styles.summaryValue, { color: '#1d4ed8' }]}>
                {confirmedCount} faxina{confirmedCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.tabBg }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'profile' && [styles.tabItemActive, { backgroundColor: theme.white }]]}
          onPress={() => handleTabChange('profile')}
        >
          <User color={activeTab === 'profile' ? theme.primary : theme.textGray} size={18} />
          <Text style={[styles.tabLabel, { color: theme.textGray }, activeTab === 'profile' && { color: theme.primary }]}>
            Perfil
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'pedidos' && [styles.tabItemActive, { backgroundColor: theme.white }]]}
          onPress={() => handleTabChange('pedidos')}
        >
          <Users color={activeTab === 'pedidos' ? theme.primary : theme.textGray} size={18} />
          <Text style={[styles.tabLabel, { color: theme.textGray }, activeTab === 'pedidos' && { color: theme.primary }]}>
            Pedidos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'agenda' && [styles.tabItemActive, { backgroundColor: theme.white }]]}
          onPress={() => handleTabChange('agenda')}
        >
          <Calendar color={activeTab === 'agenda' ? theme.primary : theme.textGray} size={18} />
          <Text style={[styles.tabLabel, { color: theme.textGray }, activeTab === 'agenda' && { color: theme.primary }]}>
            Agenda
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'pedidos' ? (
        loadingBookings ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={{ fontSize: 40 }}>📋</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textGray }]}>Você não tem novos pedidos no momento.</Text>
            <Text style={[styles.emptyDesc, { color: theme.textLight }]}>
              Novas oportunidades podem aparecer a qualquer momento!
            </Text>
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007bff']} />}
            ListHeaderComponent={
              <Text style={[styles.sectionTitle, { color: theme.textDark }]}>
                {bookings.length} solicitaç{bookings.length > 1 ? 'ões' : 'ão'} pendente{bookings.length > 1 ? 's' : ''}
              </Text>
            }
            renderItem={({ item: booking }) => {
              const isUpdating = updatingBooking === booking.id;
              const dataHora = formatBookingDateTime(booking.scheduled_date, booking.estimated_hours);

              return (
                <View style={[styles.connectionCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                    <UserAvatar
                      url={booking.client.avatar_url}
                      name={booking.client.full_name}
                      size={48}
                    />
                    <View style={styles.connectionInfo}>
                      <Text style={[styles.bookingClientName, { color: theme.textDark }]}>{formatDisplayName(booking.client.full_name)}</Text>
                      <Text style={[styles.bookingDetail, { color: theme.textGray }]}>
                        📅 {dataHora}
                      </Text>
                      <Text style={[styles.bookingObs, { color: theme.textLight }]}>
                        🏠 {propertySizeLabel(booking.property_size_category)}
                      </Text>
                      {booking.observations ? (
                        <Text style={[styles.bookingObs, { color: theme.textLight }]} numberOfLines={2}>
                          📝 {booking.observations}
                        </Text>
                      ) : null}
                      <Text style={[styles.bookingPrice, { color: theme.success }]}>
                        R$ {maskPrice(booking.total_price.toString())}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={[styles.bookingActionBtn, styles.bookingWhatsBtn]}
                      onPress={() => {
                        const numeroLimpo = booking.client.phone.replace(/\D/g, '');
                        const msg = `Olá ${formatDisplayName(booking.client.full_name)}, recebi sua solicitação pelo DiaristCWB!`;
                        Linking.openURL(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(msg)}`);
                      }}
                    >
                      <MessageCircle color="#fff" size={16} />
                      <Text style={styles.bookingActionText}> WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.bookingActionBtn, styles.bookingAcceptBtn]}
                      onPress={() => handleAcceptBooking(booking.id)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.bookingActionText}>✅ Confirmar</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.bookingActionBtn, styles.bookingRejectBtn]}
                      onPress={() => handleCancelBooking(booking.id)}
                      disabled={isUpdating}
                    >
                      <Text style={styles.bookingActionText}>❌ Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )
      ) : activeTab === 'agenda' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.agendaSubTabBar, { backgroundColor: theme.tabBg, borderColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.agendaSubTab, agendaSubTab === 'active' && { backgroundColor: theme.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1 }]}
              onPress={() => setAgendaSubTab('active')}
            >
              <Text style={[styles.agendaSubTabText, { color: agendaSubTab === 'active' ? theme.primary : theme.textGray }]}>Ativos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.agendaSubTab, agendaSubTab === 'completed' && { backgroundColor: theme.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1 }]}
              onPress={() => setAgendaSubTab('completed')}
            >
              <Text style={[styles.agendaSubTabText, { color: agendaSubTab === 'completed' ? theme.primary : theme.textGray }]}>Concluídas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.agendaSubTab, agendaSubTab === 'cancelled' && { backgroundColor: theme.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1 }]}
              onPress={() => setAgendaSubTab('cancelled')}
            >
              <Text style={[styles.agendaSubTabText, { color: agendaSubTab === 'cancelled' ? theme.primary : theme.textGray }]}>Canceladas</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007bff']} />}
          >
            {loadingAgenda ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : agendaSubTab === 'active' ? (
              confirmedBookings.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Text style={{ fontSize: 40 }}>🗓️</Text>
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.textGray }]}>Sua agenda está livre por enquanto!</Text>
                  <Text style={[styles.emptyDesc, { color: theme.textLight }]}>
                    Que tal verificar os pedidos pendentes na aba ao lado?
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.textDark }]}>
                    {confirmedBookings.length} faxina{confirmedBookings.length !== 1 ? 's' : ''} confirmada{confirmedBookings.length !== 1 ? 's' : ''}
                  </Text>
                  {confirmedBookings.map((booking) => {
                    const dataHora = formatBookingDateTime(booking.scheduled_date, booking.estimated_hours);

                    return (
                      <View key={booking.id} style={[styles.connectionCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
                        <View style={styles.agendaCardHeader}>
                          <UserAvatar
                            url={booking.client.avatar_url}
                            name={booking.client.full_name}
                            size={48}
                          />
                          <View style={styles.agendaCardInfo}>
                            <Text style={[styles.bookingClientName, { color: theme.textDark }]}>{formatDisplayName(booking.client.full_name)}</Text>
                            <View style={styles.agendaBadgeRow}>
                              <View style={[styles.agendaBadge, { backgroundColor: '#dcfce7' }]}>
                                <Text style={[styles.agendaBadgeText, { color: '#166534' }]}>Confirmado</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={[styles.agendaDivider, { backgroundColor: theme.border }]} />

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>📅</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textDark }]}>{dataHora}</Text>
                        </View>

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>🏠</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textDark }]}>
                            {propertySizeLabel(booking.property_size_category)}
                          </Text>
                        </View>

                        {booking.observations ? (
                          <View style={styles.agendaDetailRow}>
                            <Text style={styles.agendaDetailIcon}>📝</Text>
                            <Text style={[styles.agendaDetailText, { color: theme.textGray }]}>{booking.observations}</Text>
                          </View>
                        ) : null}

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>💰</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.success, fontWeight: '700' }]}>
                            R$ {maskPrice(booking.total_price.toString())}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.agendaWhatsBtn}
                          onPress={() => {
                            const numeroLimpo = booking.client.phone.replace(/\D/g, '');
                            const [dataCurta] = dataHora.split(' ');
                            const msg = `Olá ${formatDisplayName(booking.client.full_name)}, sou a diarista do seu agendamento do dia ${dataCurta}!`;
                            Linking.openURL(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(msg)}`);
                          }}
                        >
                          <MessageCircle color="#fff" size={20} />
                          <Text style={styles.agendaWhatsText}>Falar com Cliente</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.completeBtn}
                          onPress={() => handleCompleteBooking(booking)}
                          disabled={updatingBooking === booking.id}
                        >
                          {updatingBooking === booking.id ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <CheckCircle color="#fff" size={20} />
                              <Text style={styles.completeBtnText}>Finalizar Faxina</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )
            ) : agendaSubTab === 'completed' ? (
              completedBookings.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Text style={{ fontSize: 40 }}>✅</Text>
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.textGray }]}>Nenhuma faxina concluída este mês</Text>
                  <Text style={[styles.emptyDesc, { color: theme.textLight }]}>
                    As faxinas concluídas aparecerão aqui para você auditar seus ganhos.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.textDark }]}>
                    {completedBookings.length} faxina{completedBookings.length !== 1 ? 's' : ''} concluída{completedBookings.length !== 1 ? 's' : ''} (mês atual)
                  </Text>
                  {completedBookings.map((booking) => {
                    const dataHora = formatBookingDateTime(booking.scheduled_date, booking.estimated_hours);

                    return (
                      <View key={booking.id} style={[styles.connectionCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
                        <View style={styles.agendaCardHeader}>
                          <UserAvatar
                            url={booking.client.avatar_url}
                            name={booking.client.full_name}
                            size={48}
                          />
                          <View style={styles.agendaCardInfo}>
                            <Text style={[styles.bookingClientName, { color: theme.textDark }]}>{formatDisplayName(booking.client.full_name)}</Text>
                            <View style={styles.agendaBadgeRow}>
                              <View style={[styles.agendaBadge, { backgroundColor: '#fef3c7' }]}>
                                <Text style={[styles.agendaBadgeText, { color: '#92400e' }]}>Concluído</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={[styles.agendaDivider, { backgroundColor: theme.border }]} />

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>📅</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textDark }]}>{dataHora}</Text>
                        </View>

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>🏠</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textDark }]}>
                            {propertySizeLabel(booking.property_size_category)}
                          </Text>
                        </View>

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>💰</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.success, fontWeight: '700' }]}>
                            R$ {maskPrice(booking.total_price.toString())}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.agendaWhatsBtn}
                          onPress={() => {
                            const numeroLimpo = booking.client.phone.replace(/\D/g, '');
                            const msg = `Olá ${formatDisplayName(booking.client.full_name)}, obrigada pela parceria!`;
                            Linking.openURL(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(msg)}`);
                          }}
                        >
                          <MessageCircle color="#fff" size={20} />
                          <Text style={styles.agendaWhatsText}>Falar com Cliente</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )
            ) : (
              cancelledBookings.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Text style={{ fontSize: 40 }}>🚫</Text>
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.textGray }]}>Nenhum cancelamento</Text>
                  <Text style={[styles.emptyDesc, { color: theme.textLight }]}>
                    Histórico de pedidos cancelados aparecerá aqui.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.textDark }]}>
                    {cancelledBookings.length} cancelamento{cancelledBookings.length !== 1 ? 's' : ''}
                  </Text>
                  {cancelledBookings.map((booking) => {
                    const dataHora = formatBookingDateTime(booking.scheduled_date, booking.estimated_hours);

                    return (
                      <View key={booking.id} style={[styles.connectionCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
                        <View style={styles.agendaCardHeader}>
                          <UserAvatar
                            url={booking.client.avatar_url}
                            name={booking.client.full_name}
                            size={48}
                          />
                          <View style={styles.agendaCardInfo}>
                            <Text style={[styles.bookingClientName, { color: theme.textDark }]}>{formatDisplayName(booking.client.full_name)}</Text>
                            <View style={styles.agendaBadgeRow}>
                              <View style={[styles.agendaBadge, { backgroundColor: '#fee2e2' }]}>
                                <Text style={[styles.agendaBadgeText, { color: '#991b1b' }]}>Cancelado</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={[styles.agendaDivider, { backgroundColor: theme.border }]} />

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>📅</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textDark }]}>{dataHora}</Text>
                        </View>

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>🏠</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textDark }]}>
                            {propertySizeLabel(booking.property_size_category)}
                          </Text>
                        </View>

                        <View style={styles.agendaDetailRow}>
                          <Text style={styles.agendaDetailIcon}>💰</Text>
                          <Text style={[styles.agendaDetailText, { color: theme.textLight }]}>
                            R$ {maskPrice(booking.total_price.toString())}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )
            )}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.avatarUploadCard, { backgroundColor: theme.white }]}>
            <TouchableOpacity style={styles.avatarUploadArea} onPress={handlePickAvatar}>
              <UserAvatar url={avatarUrl} name={fullName || 'D'} size={72} />
              <View style={[styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.white }]}>
                <Camera color="#fff" size={14} />
              </View>
              <Text style={[styles.avatarUploadText, { color: theme.primary }]}>Toque para trocar foto</Text>
            </TouchableOpacity>
          </View>

          {step === 'profile' ? (
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.cardTitle, { color: theme.textDark }]}>Seus Dados</Text>

              <Text style={[styles.label, { color: theme.label }]}>Nome Completo</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <User color={theme.textLight} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textDark }]}
                  placeholder="Seu nome"
                  placeholderTextColor={theme.textLight}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <Text style={[styles.label, { color: theme.label }]}>Telefone / WhatsApp</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Phone color={theme.textLight} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textDark }]}
                  placeholder="(41) 99999-9999"
                  placeholderTextColor={theme.textLight}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => setPhone(maskPhone(text))}
                />
              </View>

              <Text style={[styles.label, { color: theme.label }]}>Bio / Apresentação</Text>
              <View style={[styles.textAreaWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.textArea, { color: theme.textDark }]}
                  placeholder="Conte um pouco sobre você, sua experiência e suas habilidades..."
                  placeholderTextColor={theme.textLight}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={bio}
                  onChangeText={setBio}
                />
              </View>

              <Text style={[styles.label, { color: theme.label }]}>Data de Nascimento</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.textDark }]}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={theme.textLight}
                  value={birthDate}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 8);
                    let formatted = '';
                    if (digits.length > 0) formatted = digits.slice(0, 2);
                    if (digits.length > 2) formatted += '/' + digits.slice(2, 4);
                    if (digits.length > 4) formatted += '/' + digits.slice(4, 8);
                    setBirthDate(formatted);
                  }}
                  keyboardType="number-pad"
                />
              </View>

              <Text style={[styles.label, { color: theme.label }]}>Preço da Diária</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Text style={[styles.precoPrefix, { color: theme.textDark }]}>R$</Text>
                <TextInput
                  style={[styles.input, { color: theme.textDark }]}
                  placeholder="150"
                  placeholderTextColor={theme.textLight}
                  keyboardType="numeric"
                  value={formatCurrency(preco)}
                  onChangeText={(text) => setPreco(text.replace(/\D/g, ''))}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.sectionSubtitle, { color: theme.textDark }]}>Credibilidade Profissional</Text>

              <SenioritySelector
                seniority={seniority}
                onSeniorityChange={setSeniority}
                specialties={specialties}
                onSpecialtiesChange={setSpecialties}
                experienceYears={experienceYears}
                onExperienceYearsChange={setExperienceYears}
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Save color="#fff" size={18} />
                    <Text style={styles.saveButtonText}>Salvar Perfil</Text>
                  </>
                )}
              </TouchableOpacity>

              {hasAddress && (
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => setStep('address')}
                >
                  <Text style={[styles.skipButtonText, { color: theme.primary }]}>Avançar para Endereço</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <View style={styles.cardTitleRow}>
                <TouchableOpacity onPress={() => setStep('profile')}>
                  <ArrowLeft color={theme.primary} size={20} />
                </TouchableOpacity>
                <Text style={[styles.cardTitle, { color: theme.textDark }]}>Seu Bairro</Text>
              </View>

              <Text style={[styles.label, { color: theme.label }]}>Buscar Bairro</Text>
              <View style={{ zIndex: 50, width: '100%', marginBottom: 8 }}>
                <GooglePlacesAutocomplete
                  placeholder="Digite o nome do bairro..."
                  fetchDetails={true}
                  minLength={2}
                  debounce={300}
                  disableScroll={true}
                  keyboardShouldPersistTaps="handled"
                  query={{
                    key: GOOGLE_PLACES_API_KEY,
                    language: 'pt-BR',
                    components: 'country:br',
                    locationbias: 'circle:50000@-25.4284,-49.2733',
                  }}
                  onPress={(data, details = null) => {
                    if (details) {
                      const addressComponents = details.address_components;

                      const getComponent = (types: string[]) => {
                        const comp = addressComponents.find((c: any) => types.every(t => c.types.includes(t)));
                        return comp ? comp.long_name : '';
                      };

                      const neighborhood = getComponent(['sublocality_level_1']) || getComponent(['political', 'sublocality']);
                      const city = getComponent(['locality']);
                      const { lat, lng } = details.geometry.location;

                      setBairroSelecionado({
                        name: neighborhood || city,
                        latitude: lat,
                        longitude: lng,
                      });
                    }
                  }}
                  styles={{
                    textInput: { backgroundColor: theme.inputBg, color: theme.textDark, fontSize: 16, height: 45, borderRadius: 8 },
                    listView: { backgroundColor: theme.white, borderRadius: 8, elevation: 5, zIndex: 999, position: 'relative' },
                    description: { color: theme.textDark, fontWeight: 'bold' },
                    row: { backgroundColor: theme.white, padding: 12 },
                  }}
                />
              </View>

              {bairroSelecionado && (
                <View style={[styles.selectedBairro, { backgroundColor: theme.primary + '1A' }]}>
                  <MapPin color={theme.primary} size={16} />
                  <Text style={[styles.selectedBairroText, { color: theme.primary }]}>
                    Bairro selecionado: {bairroSelecionado.name}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleSaveAddress}
                disabled={saving || !bairroSelecionado}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MapPin color="#fff" size={18} />
                    <Text style={styles.saveButtonText}>Salvar Endereço</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.reviewsToggle, { backgroundColor: theme.white, borderColor: theme.border }]}
            onPress={() => {
              if (!showMyReviews) loadMyReviews();
              setShowMyReviews(!showMyReviews);
            }}
          >
            <Text style={[styles.reviewsToggleText, { color: theme.primary }]}>
              {showMyReviews ? '▼ Ocultar avaliações' : '▶ Ver Minhas Avaliações'}
            </Text>
            <Text style={[styles.reviewsToggleCount, { color: theme.textLight }]}>
              {myReviews.length} avaliaç{myReviews.length !== 1 ? 'ões' : 'ão'}
            </Text>
          </TouchableOpacity>

          {showMyReviews && (
            loadingMyReviews ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : myReviews.length === 0 ? (
              <View style={[styles.card, { backgroundColor: theme.white, alignItems: 'center', gap: 8 }]}>
                <Text style={{ fontSize: 32 }}>📝</Text>
                <Text style={{ color: theme.textGray, fontSize: 14, textAlign: 'center' }}>Nenhuma avaliação recebida ainda.</Text>
              </View>
            ) : (
              myReviews.map((rev, idx) => (
                <View
                  key={idx}
                  style={[styles.reviewCard, { backgroundColor: theme.white, borderColor: theme.border }]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewClientName, { color: theme.textDark }]}>{rev.client_name}</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Text key={s} style={{ fontSize: 16, color: s <= rev.rating ? theme.rating : theme.textLight }}>★</Text>
                      ))}
                    </View>
                  </View>
                  {rev.comment ? (
                    <Text style={[styles.reviewComment, { color: theme.textGray }]}>{rev.comment}</Text>
                  ) : null}
                  <Text style={[styles.reviewDate, { color: theme.textLight }]}>
                    {new Date(rev.created_at).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              ))
            )
          )}

          <View style={[styles.infoBox, { backgroundColor: theme.success + '1A', borderColor: theme.success + '66' }]}>
            <Text style={[styles.infoTitle, { color: theme.success }]}>✅ Pronto para trabalhar</Text>
            <Text style={[styles.infoText, { color: theme.textDark }]}>
              Com seu perfil e endereço cadastrados, você aparecerá na busca dos clientes
              que procuram por diaristas em Curitiba.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textGray,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  avatarHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.avatar,
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 1,
  },
  logoutBtn: {
    backgroundColor: colors.dangerBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: colors.tabBg,
    borderRadius: 10,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 16,
  },
  avatarUploadCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarUploadArea: {
    alignItems: 'center',
    gap: 8,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 28,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarUploadText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.label,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  precoPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
  },
  textAreaWrapper: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  textArea: {
    minHeight: 80,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  skipButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  bairroList: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    maxHeight: 200,
    overflow: 'hidden',
  },
  bairroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bairroItemActive: {
    backgroundColor: colors.primary,
  },
  bairroItemText: {
    fontSize: 15,
    color: colors.textDark,
  },
  bairroItemTextActive: {
    color: colors.white,
  },
  selectedBairro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  selectedBairroText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  connectionCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  connectionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  connectionDate: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  connectionWhatsBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  connectionWhatsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  bookingClientName: {
    fontSize: 16,
    fontWeight: '700',
  },
  bookingDetail: {
    fontSize: 13,
    marginTop: 3,
  },
  bookingObs: {
    fontSize: 12,
    marginTop: 3,
    fontStyle: 'italic',
  },
  bookingPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  bookingActionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookingWhatsBtn: {
    backgroundColor: '#22c55e',
  },
  bookingAcceptBtn: {
    backgroundColor: '#16a34a',
  },
  bookingRejectBtn: {
    backgroundColor: '#ef4444',
  },
  bookingActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textGray,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryCardSkeleton: {
    flex: 1,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIcon: {
    fontSize: 24,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  agendaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  agendaCardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  agendaSubTabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
  },
  agendaSubTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  agendaSubTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  agendaBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  agendaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  agendaBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  agendaDivider: {
    height: 1,
    marginVertical: 12,
  },
  agendaDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  agendaDetailIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  agendaDetailText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  agendaWhatsBtn: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  agendaWhatsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  completeBtn: {
    backgroundColor: '#15803d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reviewsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  reviewsToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reviewsToggleCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewClientName: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  reviewDate: {
    fontSize: 11,
    marginTop: 6,
  },
});
