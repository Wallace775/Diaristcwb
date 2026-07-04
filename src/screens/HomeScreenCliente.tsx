import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { History, Search, ArrowLeft, Sun, Moon, Heart, HelpCircle, Filter, X } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { DiaristaItem, BookingRecord, ReviewRecord } from '../types';
import MapaDiaristas, { REGIAO_CURITIBA, MapaDiaristasRef } from '../components/MapaDiaristas';
import UserAvatar from '../components/UserAvatar';
import VerifiedBadge from '../components/VerifiedBadge';
import { SENIORITY_OPTIONS, SPECIALTY_OPTIONS } from '../types';
import { maskPrice, formatDisplayName } from '../utils/masks';
import { uploadAvatar } from '../utils/storage';
import { GOOGLE_PLACES_API_KEY } from '../config/google';

interface Props {
  onLogout: () => void;
}

interface BookingWithDiarista extends BookingRecord {
  diarista: {
    full_name: string;
    phone: string;
    avatar_url: string | null;
  };
}

export default function HomeScreenCliente({ onLogout }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [busca, setBusca] = useState('');
  const [diaristas, setDiaristas] = useState<DiaristaItem[]>([]);
  const [carregandoDiaristas, setCarregandoDiaristas] = useState(true);

  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const [showConnections, setShowConnections] = useState(false);
  const [bookingHistory, setBookingHistory] = useState<BookingWithDiarista[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<BookingWithDiarista | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [diaristaRatings, setDiaristaRatings] = useState<Record<string, { average: number; count: number }>>({});
  const [userLocation, setUserLocation] = useState(false);
  const [coordenadasUsuario, setCoordenadasUsuario] = useState<{ latitude: number; longitude: number } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites'>('all');
  const [reviewBadge, setReviewBadge] = useState<string | null>(null);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [reviewsModalDiarista, setReviewsModalDiarista] = useState<DiaristaItem | null>(null);
  const [reviewsData, setReviewsData] = useState<{ client_name: string; rating: number; comment: string | null }[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const [badgeVotes, setBadgeVotes] = useState<Record<string, Record<string, number>>>({});

  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedDiarista, setSelectedDiarista] = useState<DiaristaItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<'hoje' | 'amanha' | 'outro' | null>(null);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'manha' | 'tarde' | 'noite' | null>(null);
  const [observations, setObservations] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [blockedPeriods, setBlockedPeriods] = useState<Set<'manha' | 'tarde' | 'noite'>>(new Set());

  const [miniProfileVisible, setMiniProfileVisible] = useState(false);
  const [miniProfileDiarista, setMiniProfileDiarista] = useState<DiaristaItem | null>(null);
  const [miniProfileReviews, setMiniProfileReviews] = useState<{ rating: number; comment: string | null; created_at: string; client_name: string }[]>([]);
  const [loadingMiniReviews, setLoadingMiniReviews] = useState(false);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterRating, setFilterRating] = useState<'all' | '4.0' | '4.5' | '5.0'>('all');
  const [filterSpecialties, setFilterSpecialties] = useState<string[]>([]);
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [tempFilterRating, setTempFilterRating] = useState<'all' | '4.0' | '4.5' | '5.0'>('all');
  const [tempFilterSpecialties, setTempFilterSpecialties] = useState<string[]>([]);
  const [tempFilterMaxPrice, setTempFilterMaxPrice] = useState('');
  const [activeView, setActiveView] = useState<'search' | 'orders'>('search');

  const resetBookingForm = () => {
    setSelectedDiarista(null);
    setSelectedDate(null);
    setPickedDate(null);
    setShowDatePicker(false);
    setSelectedPeriod(null);
    setObservations('');
  };

  useEffect(() => {
    buscarDiaristasDoBanco();
    carregarPerfil();
    loadFavorites();
    fetchDiaristaBadgeData();
  }, []);

  useEffect(() => {
    if (!carregandoDiaristas && diaristas.length > 0) {
      checkPendingReviews();
    }
  }, [carregandoDiaristas]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        await new Promise(resolve => setTimeout(resolve, 400));
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = position.coords;
        setCoordenadasUsuario({ latitude, longitude });
        setUserLocation(true);
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }, 500);
      } catch (error) {
        console.warn('Falha ao obter localização:', error);
      }
    })();
  }, []);

  const carregarPerfil = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserName(formatDisplayName(data.full_name || ''));
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
    } catch {
      // fallback silencioso
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

  const buscarDiaristasDoBanco = async () => {
    try {
      setCarregandoDiaristas(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          price,
          avatar_url,
          bio,
          birth_date,
          seniority,
          specialties,
          experience_years,
          addresses (
            neighborhood,
            latitude,
            longitude
          )
        `)
        .eq('user_type', 'diarista');

      if (error) throw error;

      if (!data || data.length === 0) {
        setDiaristas([]);
        return;
      }

      const diaristasFormatadas: DiaristaItem[] = data.map((item: any) => {
        const endereco = item.addresses?.[0] || null;
        const seniorityVal = item.seniority || null;
        const specialtiesArr = item.specialties || [];
        const hasCoreFields =
          !!item.full_name &&
          !!item.phone &&
          !!item.avatar_url &&
          !!item.bio &&
          !!item.birth_date &&
          !!item.price &&
          !!endereco &&
          !!seniorityVal &&
          specialtiesArr.length > 0;
        return {
          id: item.id,
          full_name: item.full_name,
          phone: item.phone,
          price: item.price ?? 150,
          avatar_url: item.avatar_url || null,
          bio: item.bio || null,
          birth_date: item.birth_date || null,
          seniority: seniorityVal,
          specialties: specialtiesArr,
          experience_years: item.experience_years || null,
          profile_verified: hasCoreFields,
          bairro: endereco ? endereco.neighborhood : 'Não informado',
          latitude: endereco ? endereco.latitude : null,
          longitude: endereco ? endereco.longitude : null,
        };
      });

      setDiaristas(diaristasFormatadas);
      fetchDiaristaRatings();
    } catch (error: any) {
      Alert.alert("Erro ao carregar", error.message || "Não foi possível carregar as profissionais.");
    } finally {
      setCarregandoDiaristas(false);
    }
  };

  const mapRef = useRef<MapaDiaristasRef>(null);
  const searchRef = useRef<any>(null);

  const handleResetMap = () => {
    setSelectedLocation(null);
    setBusca('');
    searchRef.current?.setAddressText('');
    mapRef.current?.animateToRegion(REGIAO_CURITIBA, 500);
  };

  const handleFocusOnUser = () => {
    if (!coordenadasUsuario) return;
    setSelectedLocation(null);
    setBusca('');
    searchRef.current?.setAddressText('');
    setActiveFilter('all');
    setFilterRating('all');
    setFilterSpecialties([]);
    setFilterMaxPrice('');
    mapRef.current?.animateToRegion({
      latitude: coordenadasUsuario.latitude,
      longitude: coordenadasUsuario.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 500);
  };

  const carregarHistoricoBookings = async () => {
    setLoadingHistory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bks, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!bks || bks.length === 0) {
        setBookingHistory([]);
        return;
      }

      const diaristaIds = [...new Set(bks.map((b: BookingRecord) => b.diarista_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', diaristaIds);

      const mapped: BookingWithDiarista[] = bks.map((b: BookingRecord) => ({
        ...b,
        diarista: {
          full_name: profiles?.find((p) => p.id === b.diarista_id)?.full_name || 'Profissional',
          phone: profiles?.find((p) => p.id === b.diarista_id)?.phone || '',
          avatar_url: profiles?.find((p) => p.id === b.diarista_id)?.avatar_url || null,
        },
      }));

      setBookingHistory(mapped);

      const completedIds = bks
        .filter((b: BookingRecord) => b.status === 'completed')
        .map((b: BookingRecord) => b.id);

      if (completedIds.length > 0) {
        const { data: existingReviews } = await supabase
          .from('reviews')
          .select('booking_id')
          .in('booking_id', completedIds);

        if (existingReviews) {
          setReviewedBookingIds(new Set(existingReviews.map((r) => r.booking_id)));
        }
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível carregar o histórico.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchDiaristaRatings = async () => {
    try {
      const { data } = await supabase
        .from('reviews')
        .select('evaluated_id, rating');

      if (data) {
        const ratings: Record<string, { ratings: number[] }> = {};
        for (const r of data) {
          if (!ratings[r.evaluated_id]) {
            ratings[r.evaluated_id] = { ratings: [] };
          }
          ratings[r.evaluated_id].ratings.push(r.rating);
        }

        const result: Record<string, { average: number; count: number }> = {};
        for (const [id, vals] of Object.entries(ratings)) {
          const rList = vals.ratings;
          const originalCount = rList.length;

          let weightedSum: number;
          let weightSum: number;

          if (originalCount < 5) {
            weightedSum = 0;
            weightSum = 0;
            for (const r of rList) {
              const weight = r === 1 ? 0.3 : 1.0;
              weightedSum += r * weight;
              weightSum += weight;
            }
          } else {
            weightedSum = rList.reduce((a, b) => a + b, 0);
            weightSum = rList.length;
          }

          result[id] = {
            average: weightSum > 0 ? Math.round((weightedSum / weightSum) * 10) / 10 : 0,
            count: originalCount,
          };
        }
        setDiaristaRatings(result);
      }
    } catch {
      // silencioso
    }
  };

  const fetchDiaristaBadgeData = async () => {
    try {
      const { data: completed } = await supabase
        .from('bookings')
        .select('diarista_id')
        .eq('status', 'completed');

      if (completed) {
        const counts: Record<string, number> = {};
        for (const b of completed) {
          counts[b.diarista_id] = (counts[b.diarista_id] || 0) + 1;
        }
        setCompletedCounts(counts);
      }

      const { data: badgeData } = await supabase
        .from('reviews')
        .select('evaluated_id, badge_voted')
        .not('badge_voted', 'is', null);

      if (badgeData) {
        const votes: Record<string, Record<string, number>> = {};
        for (const r of badgeData) {
          if (!votes[r.evaluated_id]) votes[r.evaluated_id] = {};
          const bv = r.badge_voted || '';
          votes[r.evaluated_id][bv] = (votes[r.evaluated_id][bv] || 0) + 1;
        }
        setBadgeVotes(votes);
      }
    } catch {
      // silencioso
    }
  };

  const carregarReviewsMiniPerfil = async (diaristaId: string) => {
    setLoadingMiniReviews(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select('rating, comment, created_at, evaluator_id')
        .eq('evaluated_id', diaristaId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const clientIds = [...new Set(data.map((r) => r.evaluator_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', clientIds);

        const mapped = data.map((r) => ({
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          client_name: formatDisplayName(profiles?.find((p) => p.id === r.evaluator_id)?.full_name || '') || 'Cliente',
        }));
        setMiniProfileReviews(mapped);
      } else {
        setMiniProfileReviews([]);
      }
    } catch {
      setMiniProfileReviews([]);
    } finally {
      setLoadingMiniReviews(false);
    }
  };

  const abrirReviewsDiarista = async (diarista: DiaristaItem) => {
    setReviewsModalDiarista(diarista);
    setReviewsModalVisible(true);
    setLoadingReviews(true);
    try {
      const { data } = await supabase
        .from('reviews')
        .select('rating, comment, evaluator_id')
        .eq('evaluated_id', diarista.id)
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
        }));
        setReviewsData(mapped);
      } else {
        setReviewsData([]);
      }
    } catch {
      setReviewsData([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadFavorites = async () => {
    try {
      setLoadingFavorites(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('favorites')
        .select('diarista_id')
        .eq('client_id', user.id);

      if (data) {
        setFavorites(new Set(data.map((f) => f.diarista_id)));
      }
    } catch {
      // silencioso
    } finally {
      setLoadingFavorites(false);
    }
  };

  const toggleFavorite = async (diaristaId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (favorites.has(diaristaId)) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('client_id', user.id)
          .eq('diarista_id', diaristaId);

        if (error) throw error;
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(diaristaId);
          return next;
        });
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ client_id: user.id, diarista_id: diaristaId });

        if (error) throw error;
        setFavorites((prev) => new Set(prev).add(diaristaId));
      }
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível atualizar favoritos.");
    }
  };

  const checkPendingReviews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: completed } = await supabase
        .from('bookings')
        .select('*, diarista:diarista_id(full_name, phone, avatar_url)')
        .eq('client_id', user.id)
        .eq('status', 'completed');

      if (!completed || completed.length === 0) return;

      const completedIds = completed.map((b) => b.id);

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('booking_id')
        .in('booking_id', completedIds);

      const reviewedIds = new Set((existingReviews || []).map((r) => r.booking_id));
      const unreviewed = completed.find((b) => !reviewedIds.has(b.id));

      if (unreviewed) {
        setReviewBooking(unreviewed as unknown as BookingWithDiarista);
        setReviewRating(0);
        setReviewComment('');
        setReviewModalVisible(true);
      }
    } catch {
      // silencioso
    }
  };

  const submitReview = async () => {
    if (!reviewBooking || reviewRating === 0) {
      Alert.alert("Atenção", "Selecione uma avaliação de 1 a 5 estrelas.");
      return;
    }

    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('reviews')
        .insert({
          booking_id: reviewBooking.id,
          evaluator_id: user.id,
          evaluated_id: reviewBooking.diarista_id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          badge_voted: reviewBadge,
        });

      if (error) throw error;

      setReviewedBookingIds(prev => new Set(prev).add(reviewBooking.id));
      fetchDiaristaRatings();
      fetchDiaristaBadgeData();

      setReviewModalVisible(false);
      setReviewBooking(null);
      setReviewRating(0);
      setReviewComment('');
      setReviewBadge(null);

      Alert.alert("Obrigado!", "Sua avaliação foi registrada com sucesso!");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível registrar a avaliação.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const abrirSolicitacoes = () => {
    setShowConnections(true);
    carregarHistoricoBookings();
  };

  function calcularDistancia(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const termoFormatado = useMemo(() => busca.trim().toLowerCase(), [busca]);

  const diaristasBase = useMemo(() => selectedLocation
    ? diaristas.filter((diarista) => {
        if (diarista.latitude == null || diarista.longitude == null) return false;
        const dist = calcularDistancia(
          selectedLocation.latitude,
          selectedLocation.longitude,
          diarista.latitude,
          diarista.longitude
        );
        return dist <= 10;
      })
    : diaristas.filter((diarista) => {
        if (termoFormatado === '') return true;
        const nomeBairro = diarista.bairro?.toLowerCase() || '';
        const contemNoBairro = nomeBairro.includes(termoFormatado);
        const bairroContidoNoTermo = termoFormatado.includes(nomeBairro);
        return contemNoBairro || bairroContidoNoTermo;
      }), [diaristas, selectedLocation, termoFormatado]);

  const diaristasFiltradas = useMemo(() => diaristasBase.filter((d) => {
    if (filterMaxPrice) {
      const maxPrice = parseFloat(filterMaxPrice);
      if (!isNaN(maxPrice) && maxPrice > 0 && d.price > maxPrice) return false;
    }
    if (filterRating !== 'all') {
      const rating = diaristaRatings[d.id];
      if (!rating) return false;
      const minVal = filterRating === '5.0' ? 5.0 : filterRating === '4.5' ? 4.5 : 4.0;
      if (rating.average < minVal) return false;
    }
    if (filterSpecialties.length > 0) {
      if (!filterSpecialties.every((s) => d.specialties.includes(s))) return false;
    }
    return true;
  }), [diaristasBase, filterRating, filterSpecialties, filterMaxPrice, diaristaRatings]);

  const diaristasExibidas = useMemo(() => (activeFilter === 'favorites'
    ? diaristasFiltradas.filter((d) => favorites.has(d.id))
    : diaristasFiltradas
  ).sort((a, b) => {
    const verifiedDiff = Number(b.profile_verified) - Number(a.profile_verified);
    if (verifiedDiff !== 0) return verifiedDiff;
    const ratingA = diaristaRatings[a.id]?.average ?? 0;
    const ratingB = diaristaRatings[b.id]?.average ?? 0;
    if (ratingA !== ratingB) return ratingB - ratingA;
    const countA = diaristaRatings[a.id]?.count ?? 0;
    const countB = diaristaRatings[b.id]?.count ?? 0;
    return countB - countA;
  }), [diaristasFiltradas, activeFilter, favorites, diaristaRatings]);

  const calcularIdade = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    let dia: number, mes: number, ano: number;
    if (birthDate.includes('/')) {
      const partes = birthDate.split('/');
      if (partes.length !== 3) return null;
      dia = parseInt(partes[0], 10);
      mes = parseInt(partes[1], 10);
      ano = parseInt(partes[2], 10);
    } else if (birthDate.includes('-')) {
      const partes = birthDate.split('-');
      if (partes.length !== 3) return null;
      ano = parseInt(partes[0], 10);
      mes = parseInt(partes[1], 10);
      dia = parseInt(partes[2], 10);
    } else {
      return null;
    }
    const dataNasc = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    let idade = hoje.getFullYear() - dataNasc.getFullYear();
    const m = hoje.getMonth() - dataNasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < dataNasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const getDiaristaBadges = (diaristaId: string) => {
    const rating = diaristaRatings[diaristaId];
    if (!rating || rating.count < 3) return [];
    const votes = badgeVotes[diaristaId] || {};
    const destaqueVotes = votes['destaque_mes'] || 0;
    const rapidaVotes = votes['rapida_eficiente'] || 0;
    const campeaVotes = votes['campea_elogios'] || 0;
    const totalCompleted = completedCounts[diaristaId] || 0;

    if (totalCompleted > 10 && rating.average >= 4.5) {
      return [{
        key: 'destaque',
        label: '🏆 Destaque do Mês',
        desc: 'Selo concedido às profissionais com maior volume de faxinas concluídas com sucesso no mês corrente.',
      }];
    }

    const candidates: { key: string; label: string; desc: string; votes: number }[] = [
      { key: 'destaque', label: '🏆 Destaque do Mês', desc: 'Selo concedido às profissionais com maior volume de faxinas concluídas com sucesso no mês corrente.', votes: destaqueVotes },
      { key: 'rapida', label: '⚡ Rápida e Eficiente', desc: 'Calculado com base no tempo real de conclusão registrado no app. Indica alta agilidade e nota máxima.', votes: rapidaVotes },
      { key: 'campea', label: '⭐ Campeã de Elogios', desc: 'Concedido a profissionais que acumularam avaliações seguidas de 5 estrelas com depoimentos positivos dos clientes.', votes: campeaVotes },
    ];

    candidates.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      const ordem = ['destaque', 'rapida', 'campea'];
      return ordem.indexOf(a.key) - ordem.indexOf(b.key);
    });

    const top = candidates[0];
    if (!top || top.votes <= 0) return [];

    if (top.key === 'destaque' && rating.average >= 4.5) {
      return [{ key: top.key, label: top.label, desc: top.desc }];
    }
    if (top.key === 'rapida' && rating.average >= 4.5) {
      return [{ key: top.key, label: top.label, desc: top.desc }];
    }
    if (top.key === 'campea' && rating.average === 5.0) {
      return [{ key: top.key, label: top.label, desc: top.desc }];
    }

    return [];
  };

  const handleAbrirBookingModal = (diarista: DiaristaItem) => {
    setSelectedDiarista(diarista);
    setSelectedDate(null);
    setPickedDate(null);
    setShowDatePicker(false);
    setSelectedPeriod(null);
    setObservations('');
    setBlockedPeriods(new Set());
    setBookingModalVisible(true);
  };

  const checkDiaristaAvailability = async (diaristId: string, dateObj: Date) => {
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('scheduled_date')
      .eq('diarista_id', diaristId)
      .eq('status', 'accepted')
      .gte('scheduled_date', startOfDay.toISOString())
      .lte('scheduled_date', endOfDay.toISOString());

    const blocked = new Set<'manha' | 'tarde' | 'noite'>();
    if (conflicts) {
      for (const c of conflicts) {
        const h = new Date(c.scheduled_date).getHours();
        if (h < 12) blocked.add('manha');
        else if (h < 18) blocked.add('tarde');
        else blocked.add('noite');
      }
    }
    setBlockedPeriods(blocked);
  };

  useEffect(() => {
    if (!selectedDiarista || !selectedDate) return;
    let dateObj: Date | null = null;
    if (selectedDate === 'hoje') {
      dateObj = new Date();
    } else if (selectedDate === 'amanha') {
      dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + 1);
    } else if (selectedDate === 'outro' && pickedDate) {
      dateObj = new Date(pickedDate);
    }
    if (dateObj) {
      checkDiaristaAvailability(selectedDiarista.id, dateObj);
    }
  }, [selectedDiarista, selectedDate, pickedDate]);

  useEffect(() => {
    if (selectedPeriod && blockedPeriods.has(selectedPeriod)) {
      setSelectedPeriod(null);
    }
  }, [blockedPeriods, selectedPeriod]);

  const handleSubmitBooking = async () => {
    if (!selectedDiarista) return;
    if (!selectedDate) {
      Alert.alert("Atenção", "Selecione a data da faxina.");
      return;
    }
    if (selectedDate === 'outro' && !pickedDate) {
      Alert.alert("Atenção", "Selecione uma data no calendário.");
      return;
    }
    if (!selectedPeriod) {
      Alert.alert("Atenção", "Selecione o período da faxina.");
      return;
    }
    if (blockedPeriods.has(selectedPeriod)) {
      Alert.alert("Indisponível", "Esse período já está reservado para esta diarista. Escolha outro.");
      return;
    }

    setSubmittingBooking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Erro", "Você precisa estar logado.");
        return;
      }

      let dateObj = new Date();
      if (selectedDate === 'hoje') {
      } else if (selectedDate === 'amanha') {
        dateObj.setDate(dateObj.getDate() + 1);
      } else if (selectedDate === 'outro' && pickedDate) {
        dateObj = new Date(pickedDate);
      }

      if (selectedPeriod === 'manha') dateObj.setHours(8, 0, 0, 0);
      else if (selectedPeriod === 'tarde') dateObj.setHours(13, 0, 0, 0);
      else if (selectedPeriod === 'noite') dateObj.setHours(18, 0, 0, 0);

      let { data: userAddress, error: addrError } = await supabase
        .from('addresses')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (addrError) throw addrError;

      if (!userAddress) {
        const { data: newAddress, error: insertError } = await supabase
          .from('addresses')
          .insert({
            profile_id: user.id,
            street: 'Centro',
            number: 's/n',
            neighborhood: 'Centro',
            city: 'Curitiba',
            state: 'PR',
            postal_code: '80000-000',
            latitude: -25.4284,
            longitude: -49.2733,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        userAddress = newAddress;
      }

      const totalPrice = selectedDiarista.price || 150;

      const { error: connError } = await supabase
        .from('connections')
        .insert([{ cliente_id: user.id, diarista_id: selectedDiarista.id }]);

      if (connError) throw connError;

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          client_id: user.id,
          diarista_id: selectedDiarista.id,
          address_id: userAddress.id,
          scheduled_date: dateObj.toISOString(),
          estimated_hours: 4,
          property_size_category: 'medium',
          observations: observations.trim() || null,
          total_price: totalPrice,
          diarista_cut: totalPrice,
          platform_fee: 0,
          status: 'pending',
          payment_status: 'pending',
        }]);

      if (bookingError) throw bookingError;

      setBookingModalVisible(false);
      resetBookingForm();

      Alert.alert(
        "Solicitação enviada!",
        `Sua solicitação para ${formatDisplayName(selectedDiarista.full_name)} foi registrada para ${dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}.`
      );

      const numeroLimpo = selectedDiarista.phone.replace(/\D/g, '');
      const msg = `Olá ${formatDisplayName(selectedDiarista.full_name)}, acabei de solicitar uma faxina pelo DiaristCWB! Agendamento para ${dateObj.toLocaleDateString('pt-BR')}.`;
      await Linking.openURL(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(msg)}`);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível completar a solicitação.");
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.clientContainer, { backgroundColor: theme.background }]}>
        <View style={styles.clientHeader}>
        {uploadingAvatar ? (
          <View style={[styles.avatarSmall, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : (
          <UserAvatar
            url={avatarUrl}
            name={userName || 'Cliente'}
            size={44}
            onPress={handlePickAvatar}
          />
        )}
        <View style={styles.headerCenter}>
          <Text style={[styles.headerGreeting, { color: theme.textDark }]}>Olá, {userName || 'Cliente'}!</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textGray }]}>Painel do Cliente</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.historyBtn, { backgroundColor: theme.primary + '1A' }]} onPress={() => { setActiveView('orders'); carregarHistoricoBookings(); }}>
            <History color={theme.primary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}>
            {isDark ? <Sun color={theme.textDark} size={20} /> : <Moon color={theme.textDark} size={20} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clientLogoutBtn, { backgroundColor: theme.dangerBg }]} onPress={onLogout}>
            <Text style={[styles.clientLogoutText, { color: theme.danger }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.clientTabBar, { backgroundColor: theme.tabBg, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.clientTab, activeView === 'search' && { backgroundColor: theme.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1 }]}
          onPress={() => setActiveView('search')}
        >
          <Search color={activeView === 'search' ? theme.primary : theme.textGray} size={16} />
          <Text style={[styles.clientTabText, { color: activeView === 'search' ? theme.primary : theme.textGray }]}>Buscar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.clientTab, activeView === 'orders' && { backgroundColor: theme.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1 }]}
          onPress={() => { setActiveView('orders'); carregarHistoricoBookings(); }}
        >
          <History color={activeView === 'orders' ? theme.primary : theme.textGray} size={16} />
          <Text style={[styles.clientTabText, { color: activeView === 'orders' ? theme.primary : theme.textGray }]}>Meus Pedidos</Text>
        </TouchableOpacity>
      </View>

      {activeView === 'search' ? (
        <>
          <View style={styles.searchRow}>
            <TouchableOpacity
              style={[styles.fakeSearchBar, { backgroundColor: theme.inputBg }]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Search color={theme.textLight} size={18} />
              <Text style={[styles.fakeSearchText, { color: theme.textLight }]}>Para onde quer a faxina?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterIconBtn, { backgroundColor: theme.primary + '1A' }]}
              onPress={() => {
                setTempFilterRating(filterRating);
                setTempFilterSpecialties(filterSpecialties);
                setTempFilterMaxPrice(filterMaxPrice
                  ? parseFloat(filterMaxPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : 'R$ 0,00');
                setFilterModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Filter color={theme.primary} size={20} />
            </TouchableOpacity>
          </View>

          {carregandoDiaristas ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={{ marginTop: 10, color: theme.textGray }}>Buscando profissionais em Curitiba...</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textDark }]}>Profissionais Próximas</Text>
              <View style={styles.mapWrapper}>
                <MapaDiaristas ref={mapRef} busca={busca} diaristas={diaristasFiltradas} selectedCoords={selectedLocation} showUserLocation={userLocation} onMarkerPress={(d) => { setMiniProfileDiarista(d); setMiniProfileVisible(true); carregarReviewsMiniPerfil(d.id); }} />
                {coordenadasUsuario && (
                  <TouchableOpacity
                    style={[styles.focusBtn, { backgroundColor: theme.background }]}
                    onPress={handleFocusOnUser}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.focusBtnIcon}>🎯</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterTab, activeFilter === 'all' ? styles.filterTabActive : { backgroundColor: theme.inputBg }]}
                  onPress={() => setActiveFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: activeFilter === 'all' ? '#fff' : theme.textDark },
                    ]}
                  >
                    Todas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterTab, activeFilter === 'favorites' ? styles.filterTabActive : { backgroundColor: theme.inputBg }]}
                  onPress={() => setActiveFilter('favorites')}
                >
                  <Heart
                    size={16}
                    color={activeFilter === 'favorites' ? '#fff' : '#ef4444'}
                    fill={activeFilter === 'favorites' ? '#fff' : '#ef4444'}
                  />
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: activeFilter === 'favorites' ? '#fff' : theme.textDark },
                    ]}
                  >
                    Favoritas
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.textDark }]}>Profissionais em Destaque</Text>

              <FlatList
                data={diaristasExibidas}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.diaristasList}
                ListEmptyComponent={
                  <View style={styles.emptyFavoritesContainer}>
                    <Heart size={48} color={theme.textLight} />
                    <Text style={[styles.emptyFavoritesText, { color: theme.textGray }]}>
                      {activeFilter === 'favorites'
                        ? 'Você ainda não adicionou nenhuma diarista aos favoritos. Mantenha o coração ativo para encontrá-las aqui!'
                        : (filterRating !== 'all' || filterSpecialties.length > 0 || filterMaxPrice
                            ? 'Nenhuma profissional encontrada com estes filtros. Tente limpar os filtros.'
                            : 'Nenhuma profissional encontrada neste bairro.')}
                    </Text>
                  </View>
                }
                renderItem={({ item: diarista }) => (
                  <View style={[styles.diaristaCard, { backgroundColor: theme.white, borderColor: theme.border }]}>
                    <TouchableOpacity
                      style={styles.favAbsoluteBtn}
                      onPress={() => toggleFavorite(diarista.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Heart
                        size={20}
                        color={favorites.has(diarista.id) ? '#ef4444' : theme.textLight}
                        fill={favorites.has(diarista.id) ? '#ef4444' : 'transparent'}
                      />
                    </TouchableOpacity>

                    <View style={styles.diaristaInfoRow}>
                      <TouchableOpacity onPress={() => {
                        if (diarista.latitude && diarista.longitude) {
                          mapRef.current?.animateToRegion({ latitude: diarista.latitude, longitude: diarista.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
                        }
                        setMiniProfileDiarista(diarista);
                        setMiniProfileVisible(true);
                        carregarReviewsMiniPerfil(diarista.id);
                      }}>
                        <UserAvatar
                          url={diarista.avatar_url}
                          name={diarista.full_name}
                          size={54}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.diaristaMainDetails}
                        onPress={() => {
                          if (diarista.latitude && diarista.longitude) {
                            mapRef.current?.animateToRegion({ latitude: diarista.latitude, longitude: diarista.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
                          }
                          setMiniProfileDiarista(diarista);
                          setMiniProfileVisible(true);
                          carregarReviewsMiniPerfil(diarista.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.diaristaNameRow}>
                          <Text style={[styles.diaristaName, { color: theme.textDark }]} numberOfLines={1}>
                            {(() => {
                              const idade = calcularIdade(diarista.birth_date);
                              const nomeExibido = formatDisplayName(diarista.full_name);
                              return idade ? `${nomeExibido}, ${idade} anos` : nomeExibido;
                            })()}
                          </Text>
                          {diarista.profile_verified && <VerifiedBadge size={16} />}
                        </View>
                        <Text style={[styles.diaristaBairro, { color: theme.textGray }]}>📍 {diarista.bairro}</Text>
                        {diarista.seniority && (
                          <Text style={[styles.diaristaSeniority, { color: theme.primary }]}>
                            {SENIORITY_OPTIONS.find((o) => o.value === diarista.seniority)?.label || diarista.seniority}
                            {diarista.experience_years != null && ` · ${diarista.experience_years}+ anos`}
                          </Text>
                        )}
                        {diarista.specialties.length > 0 && (
                          <Text style={[styles.diaristaSpecialties, { color: theme.textGray }]} numberOfLines={1}>
                            {diarista.specialties.join(' · ')}
                          </Text>
                        )}
                        <Text style={[styles.diaristaRating, { color: theme.rating }]}>
                          {diaristaRatings[diarista.id]
                            ? `⭐ ${diaristaRatings[diarista.id].average}`
                            : '⭐ Novo'}
                        </Text>
                        {getDiaristaBadges(diarista.id).map((badge) => (
                          <View key={badge.key} style={styles.badgeRow}>
                            <Text style={[styles.badgeTag, { color: theme.primary }]}>{badge.label}</Text>
                            <TouchableOpacity
                              onPress={() => Alert.alert(badge.label, badge.desc)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <HelpCircle size={14} color={theme.textLight} />
                            </TouchableOpacity>
                          </View>
                        ))}
                        {diarista.bio ? (
                          <Text style={[styles.diaristaBio, { color: theme.textGray }]} numberOfLines={2}>
                            {diarista.bio}
                          </Text>
                        ) : null}
                      </TouchableOpacity>

                      <View style={styles.priceTagContainer}>
                        <Text style={[styles.priceLabel, { color: theme.textLight }]}>Diária</Text>
                        <Text style={[styles.priceValue, { color: theme.success }]}>
                          {diarista.price ? `R$ ${maskPrice(diarista.price.toString())}` : 'A combinar'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={[styles.connectButton, { backgroundColor: theme.primary }]}
                        onPress={() => handleAbrirBookingModal(diarista)}
                      >
                        <Text style={styles.connectButtonText}>Solicitar Faxina</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reviewsButton, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                        onPress={() => abrirReviewsDiarista(diarista)}
                      >
                        <Text style={[styles.reviewsButtonText, { color: theme.textGray }]}>
                          {diaristaRatings[diarista.id]?.count || 0} avaliaç{diaristaRatings[diarista.id]?.count === 1 ? 'ão' : 'ões'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            </>
          )}
        </>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {loadingHistory ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : bookingHistory.length === 0 ? (
            <View style={[styles.emptyFavoritesContainer, { paddingTop: 60 }]}>
              <History size={48} color={theme.textLight} />
              <Text style={[styles.emptyFavoritesText, { color: theme.textGray }]}>
                Você ainda não solicitou nenhuma diarista.
              </Text>
            </View>
          ) : (
            <>
              {['pending', 'accepted', 'completed', 'cancelled'].map((status) => {
                const filtered = bookingHistory.filter((b) => b.status === status);
                if (filtered.length === 0) return null;

                const sectionLabels: Record<string, { title: string; icon: string }> = {
                  pending: { title: 'Pendentes', icon: '📋' },
                  accepted: { title: 'Confirmados', icon: '✅' },
                  completed: { title: 'Concluídos', icon: '🏁' },
                  cancelled: { title: 'Cancelados', icon: '🚫' },
                };
                const { title, icon } = sectionLabels[status];

                return (
                  <View key={status} style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textDark }]}>
                      {icon} {title} ({filtered.length})
                    </Text>
                    {filtered.map((booking) => {
                      const dataHora = new Date(booking.scheduled_date).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      });
                      const hora = new Date(booking.scheduled_date).getHours();
                      const periodo = hora < 12 ? 'Manhã' : hora < 18 ? 'Tarde' : 'Noite';

                      return (
                        <View
                          key={booking.id}
                          style={[styles.diaristaCard, { backgroundColor: theme.white, borderColor: theme.border, marginBottom: 12 }]}
                        >
                          <View style={styles.diaristaInfoRow}>
                            <UserAvatar
                              url={booking.diarista.avatar_url}
                              name={booking.diarista.full_name}
                              size={44}
                            />
                            <View style={styles.diaristaMainDetails}>
                              <Text style={[styles.diaristaName, { color: theme.textDark }]}>
                                {formatDisplayName(booking.diarista.full_name)}
                              </Text>
                              <Text style={[styles.bookingDetail, { color: theme.textGray }]}>
                                📅 {dataHora} • {periodo}
                              </Text>
                              {booking.observations ? (
                                <Text style={[styles.bookingObs, { color: theme.textLight }]} numberOfLines={1}>
                                  📝 {booking.observations}
                                </Text>
                              ) : null}
                              <Text style={[styles.bookingPrice, { color: theme.success }]}>
                                R$ {maskPrice(booking.total_price.toString())}
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.cardActionsRow, { marginTop: 12 }]}>
                            {status !== 'cancelled' && (
                              <TouchableOpacity
                                style={[styles.bookingActionBtn, { backgroundColor: '#22c55e', flex: 1 }]}
                                onPress={() => {
                                  const numeroLimpo = booking.diarista.phone.replace(/\D/g, '');
                                  Linking.openURL(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(`Olá ${formatDisplayName(booking.diarista.full_name)}, tudo bem?`)}`);
                                }}
                              >
                                <Text style={styles.bookingActionText}>Falar no WhatsApp</Text>
                              </TouchableOpacity>
                            )}
                            {status === 'completed' && !reviewedBookingIds.has(booking.id) && (
                              <TouchableOpacity
                                style={[styles.bookingActionBtn, { backgroundColor: theme.rating, flex: 1 }]}
                                onPress={() => {
                                  setReviewBooking(booking);
                                  setReviewRating(0);
                                  setReviewComment('');
                                  setReviewModalVisible(true);
                                }}
                              >
                                <Text style={styles.bookingActionText}>Avaliar</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={showConnections} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>Minhas Solicitações</Text>
              <TouchableOpacity onPress={() => setShowConnections(false)}>
                <Text style={[styles.modalClose, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : bookingHistory.length === 0 ? (
              <View style={styles.modalEmpty}>
                <History color={theme.textLight} size={40} />
                <Text style={[styles.emptyText, { color: theme.textGray }]}>
                  Você ainda não solicitou nenhuma diarista.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {bookingHistory.map((booking) => {
                  const dataFormatada = new Date(booking.scheduled_date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  });
                  const hora = new Date(booking.scheduled_date).getHours();
                  const periodo = hora < 12 ? 'Manhã' : hora < 18 ? 'Tarde' : 'Noite';
                  const statusLabel: Record<string, { text: string; color: string }> = {
                    pending: { text: 'Pendente', color: '#eab308' },
                    accepted: { text: 'Aceito', color: '#16a34a' },
                    rejected: { text: 'Recusado', color: '#ef4444' },
                    completed: { text: 'Concluído', color: '#16a34a' },
                    cancelled: { text: 'Cancelado', color: '#64748b' },
                  };
                  const st = statusLabel[booking.status] || { text: booking.status, color: '#64748b' };

                  return (
                    <View key={booking.id} style={[styles.historyCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <View style={styles.historyRow}>
                        <UserAvatar
                          url={booking.diarista.avatar_url}
                          name={booking.diarista.full_name}
                          size={44}
                        />
                        <View style={styles.historyInfo}>
                          <Text style={[styles.historyName, { color: theme.textDark }]}>{formatDisplayName(booking.diarista.full_name)}</Text>
                          <Text style={[styles.historyDate, { color: theme.textGray }]}>
                            📅 {dataFormatada} • {periodo}
                          </Text>
                          {booking.observations ? (
                            <Text style={[styles.historyObs, { color: theme.textLight }]} numberOfLines={1}>
                              📝 {booking.observations}
                            </Text>
                          ) : null}
                          <Text style={[styles.historyPrice, { color: theme.success }]}>
                            R$ {maskPrice(booking.total_price.toString())}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                          <Text style={[styles.statusText, { color: st.color }]}>{st.text}</Text>
                        </View>
                      </View>
                      <View style={styles.historyActionsRow}>
                        <TouchableOpacity
                          style={[styles.historyWhatsBtn, { backgroundColor: '#22c55e' }]}
                          onPress={() => {
                            const numeroLimpo = booking.diarista.phone.replace(/\D/g, '');
                            const msg = `Olá ${formatDisplayName(booking.diarista.full_name)}, tudo bem?`;
                            Linking.openURL(`https://wa.me/${numeroLimpo}?text=${encodeURIComponent(msg)}`);
                          }}
                        >
                          <Text style={styles.historyWhatsText}>Falar no WhatsApp</Text>
                        </TouchableOpacity>
                        {booking.status === 'completed' && !reviewedBookingIds.has(booking.id) && (
                          <TouchableOpacity
                            style={[styles.historyReviewBtn, { backgroundColor: theme.rating }]}
                            onPress={() => {
                              setReviewBooking(booking);
                              setReviewRating(0);
                              setReviewComment('');
                              setReviewModalVisible(true);
                            }}
                          >
                            <Text style={styles.historyWhatsText}>Avaliar</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={[styles.searchModalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.searchModalHeader}>
            <TouchableOpacity
              style={[styles.searchModalBack, { backgroundColor: theme.inputBg }]}
              onPress={() => setModalVisible(false)}
            >
              <ArrowLeft color={theme.textDark} size={22} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchModalInputWrapper}>
            <GooglePlacesAutocomplete
                ref={searchRef}
                placeholder="Buscar endereço em Curitiba..."
                onPress={(data, details = null) => {
                  if (details && details.geometry && details.geometry.location) {
                    const { lat, lng } = details.geometry.location;
                    setSelectedLocation({
                      latitude: lat,
                      longitude: lng,
                      latitudeDelta: 0.03,
                      longitudeDelta: 0.03,
                    });
                    setModalVisible(false);
                  } else {
                    // local sem detalhes — fallback silencioso
                  }
                }}
                onFail={() => {}}
                query={{
                  key: GOOGLE_PLACES_API_KEY,
                  language: 'pt-BR',
                  components: 'country:br',
                  locationbias: 'circle:50000@-25.4284,-49.2733',
                }}
                fetchDetails={true}
                minLength={1}
                nearbyPlacesAPI={"None" as any}
                debounce={300}
                keyboardShouldPersistTaps="handled"
                enablePoweredByContainer={false}
                  styles={{
                    container: {
                      flex: 1,
                      width: '100%',
                    },
                    textInputContainer: {
                      width: '100%',
                      paddingHorizontal: 10,
                      backgroundColor: 'transparent',
                    },
                    textInput: {
                      backgroundColor: theme.inputBg,
                      color: theme.textDark,
                      fontSize: 16,
                      borderRadius: 8,
                      height: 45,
                    },
                    listView: {
                      backgroundColor: theme.white,
                      borderRadius: 8,
                      marginTop: 5,
                      elevation: 5,
                      zIndex: 999,
                    },
                    row: {
                      backgroundColor: theme.white,
                      padding: 15,
                      height: 55,
                    },
                    description: {
                      color: theme.textDark,
                      fontSize: 15,
                      fontWeight: 'bold',
                    },
                    predefinedPlacesDescription: {
                      color: theme.textDark,
                    },
                    separator: {
                      backgroundColor: theme.border,
                      height: 1,
                    },
                  }}
                  textInputProps={{
                    placeholderTextColor: theme.textLight,
                  autoFocus: true,
                }}
              />
            </View>
        </SafeAreaView>
      </Modal>
      <Modal visible={bookingModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.textDark }]}>Agendar Faxina</Text>
                <TouchableOpacity onPress={() => { setBookingModalVisible(false); resetBookingForm(); }}>
                  <Text style={[styles.modalClose, { color: theme.primary }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
              {selectedDiarista && (
                <View style={[styles.bookingDiaristaCard, { backgroundColor: theme.inputBg }]}>
                  <UserAvatar url={selectedDiarista.avatar_url} name={selectedDiarista.full_name} size={48} />
                  <View style={styles.bookingDiaristaInfo}>
                    <Text style={[styles.bookingDiaristaName, { color: theme.textDark }]}>{formatDisplayName(selectedDiarista.full_name)}</Text>
                    <Text style={[styles.bookingDiaristaBairro, { color: theme.textGray }]}>📍 {selectedDiarista.bairro}</Text>
                    <Text style={[styles.bookingDiaristaPrice, { color: theme.success }]}>
                      R$ {maskPrice((selectedDiarista.price || 150).toString())}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.bookingSectionLabel, { color: theme.textDark }]}>Data</Text>
              <View style={styles.bookingOptionsRow}>
                {(['hoje', 'amanha', 'outro'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.bookingOption,
                      { borderColor: theme.border, backgroundColor: theme.inputBg },
                      selectedDate === opt && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                    ]}
                    onPress={() => setSelectedDate(opt)}
                  >
                    <Text style={[
                      styles.bookingOptionText,
                      { color: theme.textDark },
                      selectedDate === opt && { color: theme.primary, fontWeight: '700' },
                    ]}>
                      {opt === 'hoje' ? 'Hoje' : opt === 'amanha' ? 'Amanhã' : 'Outra data'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedDate === 'outro' && (
                <View style={styles.customDateContainer}>
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.datePickerButtonText, { color: pickedDate ? theme.textDark : theme.textLight }]}>
                      {pickedDate
                        ? `📅 ${pickedDate.toLocaleDateString('pt-BR')}`
                        : 'Toque para selecionar a data'}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={pickedDate || new Date()}
                      mode="date"
                      display="default"
                      locale="pt-BR"
                      minimumDate={new Date()}
                      onChange={(_event: DateTimePickerEvent, date?: Date) => {
                        setShowDatePicker(false);
                        if (date) setPickedDate(date);
                      }}
                    />
                  )}
                </View>
              )}

              <Text style={[styles.bookingSectionLabel, { color: theme.textDark }]}>Período</Text>
              <View style={styles.bookingOptionsRow}>
                {(['manha', 'tarde', 'noite'] as const).map((opt) => {
                  const isBlocked = blockedPeriods.has(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      disabled={isBlocked}
                      style={[
                        styles.bookingOption,
                        { borderColor: theme.border, backgroundColor: theme.inputBg },
                        selectedPeriod === opt && !isBlocked && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                        isBlocked && { opacity: 0.35, borderColor: theme.border },
                      ]}
                      onPress={() => setSelectedPeriod(opt)}
                    >
                      <Text style={[
                        styles.bookingOptionText,
                        { color: theme.textDark },
                        selectedPeriod === opt && !isBlocked && { color: theme.primary, fontWeight: '700' },
                        isBlocked && { color: theme.textLight },
                      ]}>
                        {opt === 'manha' ? 'Manhã' : opt === 'tarde' ? 'Tarde' : 'Noite'}
                      </Text>
                      <Text style={[
                        styles.bookingOptionSub,
                        { color: theme.textLight },
                        selectedPeriod === opt && !isBlocked && { color: theme.primary },
                        isBlocked && { color: theme.textLight },
                      ]}>
                        {isBlocked ? 'Indisponível' : opt === 'manha' ? '8h às 12h' : opt === 'tarde' ? '13h às 17h' : '18h às 21h'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.bookingSectionLabel, { color: theme.textDark }]}>Observações</Text>
              <TextInput
                style={[styles.bookingTextArea, { backgroundColor: theme.inputBg, color: theme.textDark, borderColor: theme.border }]}
                placeholder="Ex: Casa com 2 quartos, 1 banheiro..."
                placeholderTextColor={theme.textLight}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={observations}
                onChangeText={setObservations}
              />

              <TouchableOpacity
                style={[styles.bookingSubmitBtn, { backgroundColor: theme.primary }]}
                onPress={handleSubmitBooking}
                disabled={submittingBooking}
              >
                {submittingBooking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.bookingSubmitText}>Confirmar Solicitação</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>Avaliar Serviço</Text>
              <TouchableOpacity onPress={() => { setReviewModalVisible(false); setReviewRating(0); setReviewComment(''); setReviewBadge(null); }}>
                <Text style={[styles.modalClose, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {reviewBooking && (
                <View style={[styles.bookingDiaristaCard, { backgroundColor: theme.inputBg }]}>
                  <UserAvatar url={reviewBooking.diarista.avatar_url} name={reviewBooking.diarista.full_name} size={48} />
                  <View style={styles.bookingDiaristaInfo}>
                    <Text style={[styles.bookingDiaristaName, { color: theme.textDark }]}>{formatDisplayName(reviewBooking.diarista.full_name)}</Text>
                    <Text style={[styles.bookingDiaristaBairro, { color: theme.textGray }]}>
                      📅 {new Date(reviewBooking.scheduled_date).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.bookingSectionLabel, { color: theme.textDark }]}>Sua nota</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Text style={[styles.starIcon, { color: star <= reviewRating ? theme.rating : theme.textLight }]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.bookingSectionLabel, { color: theme.textDark }]}>Comentário (opcional)</Text>
              <TextInput
                style={[styles.bookingTextArea, { backgroundColor: theme.inputBg, color: theme.textDark, borderColor: theme.border }]}
                placeholder="Conte como foi a experiência..."
                placeholderTextColor={theme.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={reviewComment}
                onChangeText={setReviewComment}
              />

              <Text style={[styles.bookingSectionLabel, { color: theme.textDark }]}>Qual foi o maior ponto forte?</Text>
              <View style={styles.badgeChipsRow}>
                {[
                  { value: 'destaque_mes', label: '🏆 Volume e Consistência' },
                  { value: 'rapida_eficiente', label: '⚡ Agilidade e Rapidez' },
                  { value: 'campea_elogios', label: '⭐ Atendimento Impecável' },
                ].map((chip) => (
                  <TouchableOpacity
                    key={chip.value}
                    style={[
                      styles.badgeChip,
                      { borderColor: theme.border, backgroundColor: theme.inputBg },
                      reviewBadge === chip.value && { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
                    ]}
                    onPress={() => setReviewBadge(reviewBadge === chip.value ? null : chip.value)}
                  >
                    <Text style={[
                      styles.badgeChipText,
                      { color: theme.textDark },
                      reviewBadge === chip.value && { color: theme.primary, fontWeight: '700' },
                    ]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.bookingSubmitBtn, { backgroundColor: theme.primary }]}
                onPress={submitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.bookingSubmitText}>Enviar Avaliação</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>
                {formatDisplayName(reviewsModalDiarista?.full_name || '') || 'Avaliações'}
              </Text>
              <TouchableOpacity onPress={() => { setReviewsModalVisible(false); setReviewsModalDiarista(null); setReviewsData([]); }}>
                <Text style={[styles.modalClose, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            {loadingReviews ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : reviewsData.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 36 }}>📝</Text>
                <Text style={[styles.emptyText, { color: theme.textGray }]}>
                  Nenhuma avaliação ainda.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {reviewsData.map((rev, idx) => (
                  <View
                    key={idx}
                    style={[styles.reviewCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                  >
                    <View style={styles.reviewHeader}>
                      <Text style={[styles.reviewClientName, { color: theme.textDark }]}>{rev.client_name}</Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Text key={s} style={[styles.reviewStar, { color: s <= rev.rating ? theme.rating : theme.textLight }]}>★</Text>
                        ))}
                      </View>
                    </View>
                    {rev.comment ? (
                      <Text style={[styles.reviewComment, { color: theme.textGray }]}>{rev.comment}</Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={miniProfileVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>Perfil da Profissional</Text>
              <TouchableOpacity onPress={() => { setMiniProfileVisible(false); setMiniProfileDiarista(null); }}>
                <Text style={[styles.modalClose, { color: theme.primary }]}>Fechar</Text>
              </TouchableOpacity>
            </View>

            {miniProfileDiarista && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.miniProfileAvatarSection}>
                  <UserAvatar
                    url={miniProfileDiarista.avatar_url}
                    name={miniProfileDiarista.full_name}
                    size={88}
                  />
                  <View style={styles.miniProfileNameRow}>
                    <Text style={[styles.miniProfileName, { color: theme.textDark }]}>
                      {(() => {
                        const idade = calcularIdade(miniProfileDiarista.birth_date);
                        const nomeExibido = formatDisplayName(miniProfileDiarista.full_name);
                        return idade ? `${nomeExibido}, ${idade} anos` : nomeExibido;
                      })()}
                    </Text>
                    {miniProfileDiarista.profile_verified && <VerifiedBadge size={20} showLabel />}
                  </View>
                  <Text style={[styles.miniProfileBairro, { color: theme.textGray }]}>📍 {miniProfileDiarista.bairro}</Text>
                </View>

                <View style={[styles.miniProfileDivider, { backgroundColor: theme.border }]} />

                {miniProfileDiarista.seniority && (
                  <View style={styles.miniProfileInfoRow}>
                    <Text style={[styles.miniProfileInfoLabel, { color: theme.textLight }]}>Nível</Text>
                    <Text style={[styles.miniProfileInfoValue, { color: theme.textDark }]}>
                      {SENIORITY_OPTIONS.find((o) => o.value === miniProfileDiarista.seniority)?.label || miniProfileDiarista.seniority}
                      {miniProfileDiarista.experience_years != null && ` · ${miniProfileDiarista.experience_years}+ anos de experiência`}
                    </Text>
                  </View>
                )}

                {miniProfileDiarista.bio ? (
                  <View style={styles.miniProfileInfoRow}>
                    <Text style={[styles.miniProfileInfoLabel, { color: theme.textLight }]}>Sobre</Text>
                    <Text style={[styles.miniProfileInfoValue, { color: theme.textGray, lineHeight: 20 }]}>
                      {miniProfileDiarista.bio}
                    </Text>
                  </View>
                ) : null}

                {miniProfileDiarista.specialties.length > 0 && (
                  <View style={styles.miniProfileInfoRow}>
                    <Text style={[styles.miniProfileInfoLabel, { color: theme.textLight }]}>Especialidades</Text>
                    <View style={styles.miniProfileSpecialtiesGrid}>
                      {miniProfileDiarista.specialties.map((tag) => (
                        <View
                          key={tag}
                          style={[styles.miniProfileSpecialtyTag, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                        >
                          <Text style={[styles.miniProfileSpecialtyText, { color: theme.primary }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.miniProfilePriceRow}>
                  <Text style={[styles.miniProfilePriceLabel, { color: theme.textLight }]}>Valor da Diária</Text>
                  <Text style={[styles.miniProfilePriceValue, { color: theme.success }]}>
                    {miniProfileDiarista.price ? `R$ ${maskPrice(miniProfileDiarista.price.toString())}` : 'A combinar'}
                  </Text>
                </View>

                <View style={[styles.miniProfileDivider, { backgroundColor: theme.border }]} />

                <View style={styles.miniProfileInfoRow}>
                  <Text style={[styles.miniProfileInfoLabel, { color: theme.textLight }]}>Avaliações dos Clientes</Text>
                  {(() => {
                    const ratingData = diaristaRatings[miniProfileDiarista.id];
                    const avg = ratingData?.average;
                    const count = ratingData?.count || 0;
                    return (
                      <Text style={[styles.miniProfileRatingSummary, { color: theme.rating }]}>
                        ⭐ {avg ? avg.toFixed(1) : '—'} · {count} avaliaç{count === 1 ? 'ão' : 'ões'}
                      </Text>
                    );
                  })()}
                </View>

                {loadingMiniReviews ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                ) : miniProfileReviews.length === 0 ? (
                  <Text style={[styles.miniProfileEmptyReviews, { color: theme.textLight }]}>
                    Nenhuma avaliação detalhada ainda.
                  </Text>
                ) : (
                  miniProfileReviews.map((rev, idx) => (
                    <View
                      key={idx}
                      style={[styles.miniProfileReviewCard, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
                    >
                      <View style={styles.miniProfileReviewHeader}>
                        <Text style={[styles.miniProfileReviewClientName, { color: theme.textDark }]}>
                          {rev.client_name}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Text key={s} style={[styles.miniProfileReviewStar, { color: s <= rev.rating ? theme.rating : theme.textLight }]}>★</Text>
                          ))}
                        </View>
                      </View>
                      {rev.comment ? (
                        <Text style={[styles.miniProfileReviewComment, { color: theme.textGray }]}>{rev.comment}</Text>
                      ) : (
                        <Text style={[styles.miniProfileReviewComment, { color: theme.textLight, fontStyle: 'italic' }]}>
                          Sem comentário escrito
                        </Text>
                      )}
                      <Text style={[styles.miniProfileReviewDate, { color: theme.textLight }]}>
                        {new Date(rev.created_at).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                  ))
                )}

                <TouchableOpacity
                  style={[styles.miniProfileBookBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    setMiniProfileVisible(false);
                    handleAbrirBookingModal(miniProfileDiarista);
                  }}
                >
                  <Text style={styles.miniProfileBookBtnText}>Solicitar Faxina</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={filterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>Filtros Avançados</Text>
              <TouchableOpacity onPress={() => {
                setFilterRating(tempFilterRating);
                setFilterSpecialties(tempFilterSpecialties);
                if (tempFilterMaxPrice === 'R$ 0,00' || !tempFilterMaxPrice) {
                  setFilterMaxPrice('');
                } else {
                  const extracted = parseFloat(tempFilterMaxPrice.replace(/[R$\s.]/g, '').replace(',', '.'));
                  setFilterMaxPrice(isNaN(extracted) ? '' : extracted.toString());
                }
                setFilterModalVisible(false);
              }}>
                <X color={theme.textDark} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterModalSectionTitle, { color: theme.textDark }]}>Avaliação Mínima</Text>
              <View style={styles.filterModalRatingRow}>
                {(['all', '4.0', '4.5', '5.0'] as const).map((opt) => {
                  const label = opt === 'all' ? 'Todas' : `${opt}+`;
                  const isActive = tempFilterRating === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.filterModalRatingBtn,
                        { backgroundColor: isActive ? theme.primary : theme.inputBg, borderColor: isActive ? theme.primary : theme.border },
                      ]}
                      onPress={() => setTempFilterRating(opt)}
                    >
                      <Text style={{ color: isActive ? '#fff' : theme.textDark, fontWeight: '600', fontSize: 14 }}>
                        {opt !== 'all' && <Text style={{ fontSize: 16 }}>⭐ </Text>}
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.filterModalSectionTitle, { color: theme.textDark, marginTop: 24 }]}>Especialidades</Text>
              <View style={styles.filterModalSpecialtiesGrid}>
                {SPECIALTY_OPTIONS.map((tag) => {
                  const isActive = tempFilterSpecialties.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.filterModalSpecialtyTag,
                        { backgroundColor: isActive ? theme.primary + '20' : theme.inputBg, borderColor: isActive ? theme.primary : theme.border },
                      ]}
                      onPress={() => {
                        setTempFilterSpecialties((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                        );
                      }}
                    >
                      <Text style={[styles.filterModalSpecialtyText, { color: isActive ? theme.primary : theme.textDark }]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.filterModalSectionTitle, { color: theme.textDark, marginTop: 24 }]}>Preço Máximo da Diária</Text>
              <TextInput
                style={[styles.filterModalPriceInput, { backgroundColor: theme.inputBg, color: theme.textDark, borderColor: theme.border }]}
                placeholder="R$ 0,00"
                placeholderTextColor={theme.textLight}
                keyboardType="numeric"
                value={tempFilterMaxPrice}
                onChangeText={(text) => {
                  const cleanValue = text.replace(/\D/g, '');
                  if (!cleanValue) {
                    setTempFilterMaxPrice('R$ 0,00');
                    return;
                  }
                  const numericValue = parseFloat(cleanValue) / 100;
                  const formatted = new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(numericValue);
                  setTempFilterMaxPrice(formatted);
                }}
              />
            </ScrollView>

            <View style={styles.filterModalActions}>
              <TouchableOpacity
                style={[styles.filterModalClearBtn, { borderColor: theme.border }]}
                onPress={() => {
                  setTempFilterRating('all');
                  setTempFilterSpecialties([]);
                  setTempFilterMaxPrice('R$ 0,00');
                  setFilterRating('all');
                  setFilterSpecialties([]);
                  setFilterMaxPrice('');
                }}
              >
                <Text style={[styles.filterModalClearText, { color: theme.textDark }]}>Limpar Filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterModalApplyBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setFilterRating(tempFilterRating);
                  setFilterSpecialties(tempFilterSpecialties);
                  if (tempFilterMaxPrice === 'R$ 0,00' || !tempFilterMaxPrice) {
                    setFilterMaxPrice('');
                  } else {
                    const extracted = parseFloat(tempFilterMaxPrice.replace(/[R$\s.]/g, '').replace(',', '.'));
                    setFilterMaxPrice(isNaN(extracted) ? '' : extracted.toString());
                  }
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.filterModalApplyText}>Aplicar Filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  clientContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    marginTop: 10,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 12,
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
  },
  clientWelcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  clientSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientLogoutBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clientLogoutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  fakeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flex: 1,
    gap: 10,
  },
  fakeSearchText: {
    fontSize: 15,
    color: '#9ca3af',
    flex: 1,
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchModalHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchModalBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchModalInputWrapper: {
    flex: 1,
  },
  searchModalAutocomplete: {
    flex: 1,
  },
  searchModalTextInputContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
  },
  searchModalTextInput: {
    paddingVertical: 14,
    paddingHorizontal: 0,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: 'transparent',
    margin: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  searchModalListView: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  searchModalRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  searchModalDescription: {
    fontSize: 15,
    color: '#0f172a',
  },
  searchModalSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  searchModalPowered: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mapWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  resetMapBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
  },
  resetMapText: {
    fontSize: 13,
    fontWeight: '600',
  },
  focusBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
  },
  focusBtnIcon: {
    fontSize: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterModalRatingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterModalRatingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalSpecialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterModalSpecialtyTag: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  filterModalSpecialtyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterModalPriceInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  filterModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  filterModalClearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalClearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterModalApplyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalApplyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  diaristasList: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  diaristaCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  favAbsoluteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaristaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  diaristaMainDetails: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 40,
  },
  diaristaName: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  diaristaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diaristaBairro: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  diaristaSeniority: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  diaristaSpecialties: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  diaristaRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#eab308',
    marginTop: 6,
  },
  priceTagContainer: {
    alignItems: 'flex-end',
    paddingRight: 44,
    marginTop: 10,
  },
  priceLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 20,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '75%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalClose: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  connectionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  connectionDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  connectionWhatsBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  connectionWhatsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDiaristaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  bookingDiaristaInfo: {
    flex: 1,
    marginLeft: 14,
  },
  bookingDiaristaName: {
    fontSize: 16,
    fontWeight: '700',
  },
  bookingDiaristaBairro: {
    fontSize: 13,
    marginTop: 2,
  },
  bookingDiaristaPrice: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  bookingSectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
  },
  bookingOptionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  bookingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  bookingOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingOptionSub: {
    fontSize: 11,
    marginTop: 3,
  },
  bookingInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 18,
  },
  bookingTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 24,
  },
  bookingSubmitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  bookingSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  historyCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 12,
    marginTop: 2,
  },
  historyObs: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  historyPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  historyWhatsBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyReviewBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  historyWhatsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  starIcon: {
    fontSize: 36,
  },
  customDateContainer: {
    marginBottom: 18,
  },
  datePickerButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: '#2563eb',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyFavoritesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyFavoritesText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  badgeTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  badgeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  badgeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewsButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  reviewsButtonText: {
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
  reviewStar: {
    fontSize: 16,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 18,
  },
  diaristaBio: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
  },
  miniProfileAvatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  miniProfileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  miniProfileName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  miniProfileBairro: {
    fontSize: 14,
    marginTop: 4,
  },
  miniProfileDivider: {
    height: 1,
    marginVertical: 16,
  },
  miniProfileInfoRow: {
    marginBottom: 16,
  },
  miniProfileInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  miniProfileInfoValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  miniProfileSpecialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniProfileSpecialtyTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniProfileSpecialtyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  miniProfilePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  miniProfilePriceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  miniProfilePriceValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  miniProfileRatingSummary: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  miniProfileEmptyReviews: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  miniProfileReviewCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  miniProfileReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  miniProfileReviewClientName: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniProfileReviewStar: {
    fontSize: 14,
  },
  miniProfileReviewComment: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  miniProfileReviewDate: {
    fontSize: 11,
    marginTop: 6,
  },
  miniProfileBookBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  miniProfileBookBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  clientTabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
  },
  clientTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clientTabText: {
    fontSize: 13,
    fontWeight: '600',
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
  bookingActionBtn: {
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookingActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
