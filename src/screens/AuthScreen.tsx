import React, { useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Mail, Lock, User, Phone, Briefcase, UserCheck, Sun, Moon } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors } from '../styles/theme';
import { UserType } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { maskPhone, isValidEmail, isValidPhone, extractDigits, formatCPF } from '../utils/masks';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../config/google';

interface Props {
  onAuthSuccess: (type: UserType) => void;
}

export default function AuthScreen({ onAuthSuccess }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [userType, setUserType] = useState<UserType>('cliente');
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url) return;

      if (url.includes('redefinir-senha')) {
        try {
          const parsedUrl = new URL(url);
          const fragment = parsedUrl.hash.replace('#', '');
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (!error) {
              setShowResetPasswordForm(true);
            }
          }
        } catch (err) {
          console.error('Erro ao processar deep link:', err);
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, []);

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !phone) {
      Alert.alert("Atenção", "Por favor, preencha todos os campos.");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Atenção", "Informe um e-mail válido.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Atenção", "A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert("Atenção", "Informe um telefone válido com DDD, ex: (41) 99999-9999.");
      return;
    }

    const cpfDigits = extractDigits(cpf);
    if (!cpf || cpfDigits.length !== 11) {
      Alert.alert("Atenção", "Informe um CPF válido com 11 dígitos.");
      return;
    }

    if (userType === 'diarista' && !selectedAddress) {
      Alert.alert("Atenção", "Para se cadastrar como diarista, informe seu endereço de atendimento.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          Alert.alert(
            "E-mail já cadastrado",
            "Você já possui uma conta cadastrada! Por favor, faça o login normalmente. Dentro do seu painel, você poderá ativar ou alternar para o outro perfil a qualquer momento."
          );
          return;
        }
        throw authError;
      }

      if (authData?.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            full_name: fullName,
            phone,
            cpf: cpfDigits,
            user_type: userType,
          }]);

        if (profileError) {
          await supabase.auth.signOut();
          if (profileError.message?.includes('cpf_e_tipo_unicos') || profileError.message?.includes('violates unique constraint')) {
            Alert.alert("CPF já cadastrado", "Este CPF já está cadastrado para este tipo de conta.");
          } else {
            Alert.alert("Erro no Cadastro", profileError.message || "Ocorreu um erro inesperado.");
          }
          return;
        }

        if (userType === 'diarista' && selectedAddress) {
          const { error: addressError } = await supabase
            .from('addresses')
            .insert([{
              profile_id: authData.user.id,
              street: selectedAddress.street,
              number: selectedAddress.number,
              complement: '',
              neighborhood: selectedAddress.neighborhood,
              city: selectedAddress.city,
              state: selectedAddress.state,
              postal_code: selectedAddress.postal_code,
              latitude: selectedAddress.latitude,
              longitude: selectedAddress.longitude,
            }]);

          if (addressError) throw addressError;
        }

        if (!authData.session) {
          setEmail('');
          setPassword('');
          setFullName('');
          setPhone('');
          setCpf('');
          setSelectedAddress(null);
          setUserType('cliente');
          setActiveTab('entrar');
          Alert.alert(
            "Confirme seu E-mail!",
            "Enviamos um link de ativação para o seu e-mail. Por favor, verifique sua caixa de entrada (e a pasta de spam) para ativar sua conta antes de fazer o login."
          );
        } else {
          Alert.alert("Sucesso!", "Sua conta foi criada.");
          onAuthSuccess(userType);
        }
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('cpf_e_tipo_unicos') || msg.includes('violates unique constraint')) {
        Alert.alert("CPF já cadastrado", "Este CPF já está cadastrado para este tipo de conta.");
      } else {
        Alert.alert("Erro no Cadastro", error.message || "Ocorreu um erro inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData?.user) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        if (profiles && profiles.length > 0) {
          onAuthSuccess(profiles[0].user_type as UserType);
        } else {
          onAuthSuccess('cliente');
        }
      }
    } catch (error: any) {
      Alert.alert("Erro no Login", error.message || "E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert("Atenção", "Informe seu e-mail para receber o link de recuperação.");
      return;
    }

    if (!isValidEmail(resetEmail)) {
      Alert.alert("Atenção", "Informe um e-mail válido.");
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'diaristcwb://redefinir-senha',
      });

      if (error) throw error;

      Alert.alert("Link enviado!", "Verifique sua caixa de entrada para redefinir sua senha.");
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Ocorreu um erro ao enviar o link de recuperação.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Atenção", "A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Atenção", "As senhas não conferem.");
      return;
    }

    setResetPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      Alert.alert("Sucesso!", "Sua senha foi redefinida com sucesso.");
      setShowResetPasswordForm(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Ocorreu um erro ao redefinir a senha.");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity
              onPress={toggleTheme}
              style={styles.themeToggle}
            >
              {isDark ? <Sun color={theme.textDark} size={22} /> : <Moon color={theme.textDark} size={22} />}
            </TouchableOpacity>
            <Image
              source={require('./screens/Logo.png')}
              style={{ width: 200, height: 150, resizeMode: 'contain' }}
            />
            <Text style={[styles.subtitle, { color: theme.textGray }]}>Encontre ou ofereça serviços de faxina em Curitiba</Text>
          </View>

          {showResetPasswordForm ? (
            <View style={[styles.card, { backgroundColor: theme.white }]}>
              <Text style={[styles.modalTitle, { color: theme.textDark, marginBottom: 8 }]}>Redefinir Senha</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textGray }]}>
                Digite sua nova senha para acessar o aplicativo.
              </Text>

              <Text style={[styles.inputLabel, { color: theme.label }]}>Nova Senha</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Lock color={theme.textLight} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textDark }]}
                  placeholder="No mínimo 6 caracteres"
                  placeholderTextColor={theme.textLight}
                  secureTextEntry
                  autoCapitalize="none"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <Text style={[styles.inputLabel, { color: theme.label }]}>Confirmar Nova Senha</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Lock color={theme.textLight} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.textDark }]}
                  placeholder="Repita a nova senha"
                  placeholderTextColor={theme.textLight}
                  secureTextEntry
                  autoCapitalize="none"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
                onPress={handleResetPassword}
                disabled={resetPasswordLoading}
              >
                {resetPasswordLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Salvar Nova Senha</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => {
                  setShowResetPasswordForm(false);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                disabled={resetPasswordLoading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.textGray }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.tabContainer, { backgroundColor: theme.tabBg }]}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'entrar' && [styles.activeTabButton, { backgroundColor: theme.white }]]}
                  onPress={() => setActiveTab('entrar')}
                >
                  <Text style={[styles.tabText, { color: theme.textGray }, activeTab === 'entrar' && { color: theme.textDark }]}>Entrar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'cadastrar' && [styles.activeTabButton, { backgroundColor: theme.white }]]}
                  onPress={() => setActiveTab('cadastrar')}
                >
                  <Text style={[styles.tabText, { color: theme.textGray }, activeTab === 'cadastrar' && { color: theme.textDark }]}>Cadastrar</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.card, { backgroundColor: theme.white }]}>
                {activeTab === 'cadastrar' && (
                  <>
                    <Text style={[styles.inputLabel, { color: theme.label }]}>Nome Completo</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <User color={theme.textLight} size={20} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: theme.textDark }]}
                        placeholder="Seu nome completo"
                        placeholderTextColor={theme.textLight}
                        value={fullName}
                        onChangeText={setFullName}
                      />
                    </View>

                    <Text style={[styles.inputLabel, { color: theme.label }]}>Telefone / WhatsApp</Text>
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

                    <Text style={[styles.inputLabel, { color: theme.label }]}>CPF</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <Text style={[styles.inputIcon, { fontSize: 20, color: theme.textLight }]}>🔒</Text>
                      <TextInput
                        style={[styles.input, { color: theme.textDark }]}
                        placeholder="000.000.000-00"
                        placeholderTextColor={theme.textLight}
                        keyboardType="numeric"
                        value={cpf}
                        onChangeText={(text) => setCpf(formatCPF(text))}
                      />
                    </View>

                    <Text style={[styles.inputLabel, { color: theme.label }]}>Tipo de Perfil</Text>
                    <View style={styles.typeContainer}>
                      <TouchableOpacity
                        style={[styles.typeButton, { backgroundColor: theme.inputBg, borderColor: theme.border }, userType === 'cliente' && styles.typeButtonActive]}
                        onPress={() => setUserType('cliente')}
                      >
                        <UserCheck color={userType === 'cliente' ? '#fff' : theme.textGray} size={20} />
                        <Text style={[styles.typeButtonText, { color: theme.textGray }, userType === 'cliente' && styles.typeButtonTextActive]}>Quero Contratar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.typeButton, { backgroundColor: theme.inputBg, borderColor: theme.border }, userType === 'diarista' && styles.typeButtonActive]}
                        onPress={() => setUserType('diarista')}
                      >
                        <Briefcase color={userType === 'diarista' ? '#fff' : theme.textGray} size={20} />
                        <Text style={[styles.typeButtonText, { color: theme.textGray }, userType === 'diarista' && styles.typeButtonTextActive]}>Sou Diarista</Text>
                      </TouchableOpacity>
                    </View>

                    {userType === 'diarista' && (
                      <View style={{ zIndex: 50, width: '100%', marginBottom: 15 }}>
                        <Text style={[styles.inputLabel, { color: theme.label }]}>Endereço Comercial / Atendimento</Text>
                        <GooglePlacesAutocomplete
                          placeholder="Digite seu endereço completo..."
                          fetchDetails={true}
                          minLength={2}
                          debounce={300}
                          disableScroll={true}
                          listViewProps={{
                            keyboardShouldPersistTaps: 'handled',
                          }}
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

                              const street = getComponent(['route']);
                              const number = getComponent(['street_number']);
                              const neighborhood = getComponent(['sublocality_level_1']) || getComponent(['political', 'sublocality']);
                              const city = getComponent(['locality']);
                              const state = getComponent(['administrative_area_level_1']);
                              const postal_code = getComponent(['postal_code']).replace(/\D/g, '');
                              const { lat, lng } = details.geometry.location;

                              setSelectedAddress({
                                street,
                                number,
                                neighborhood,
                                city,
                                state,
                                postal_code,
                                latitude: lat,
                                longitude: lng
                              });
                            }
                          }}
                          styles={{
                            textInput: { backgroundColor: theme.inputBg, color: theme.textDark, fontSize: 16, height: 45, borderRadius: 8 },
                            listView: { backgroundColor: theme.white, borderRadius: 8, elevation: 5, zIndex: 999, position: 'relative' },
                            description: { color: theme.textDark, fontWeight: 'bold' },
                            row: { backgroundColor: theme.white, padding: 12 }
                          }}
                        />
                      </View>
                    )}
                  </>
                )}

                <Text style={[styles.inputLabel, { color: theme.label }]}>E-mail</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <Mail color={theme.textLight} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.textDark }]}
                    placeholder="seu-email@exemplo.com"
                    placeholderTextColor={theme.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <Text style={[styles.inputLabel, { color: theme.label }]}>Senha</Text>
                <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <Lock color={theme.textLight} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.textDark }]}
                    placeholder="No mínimo 6 caracteres"
                    placeholderTextColor={theme.textLight}
                    secureTextEntry
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                {activeTab === 'entrar' && (
                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => setShowForgotPassword(true)}
                  >
                    <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>Esqueci minha senha</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: theme.primary }]}
                  onPress={activeTab === 'entrar' ? handleLogin : handleSignUp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {activeTab === 'entrar' ? 'Entrar no Aplicativo' : 'Concluir Cadastro'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showForgotPassword}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.white }]}>
            <Text style={[styles.modalTitle, { color: theme.textDark }]}>Redefinir Senha</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textGray }]}>
              Digite seu e-mail para receber o link de redefinição de senha.
            </Text>

            <Text style={[styles.inputLabel, { color: theme.label }]}>E-mail</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Mail color={theme.textLight} size={20} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textDark }]}
                placeholder="seu-email@exemplo.com"
                placeholderTextColor={theme.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                value={resetEmail}
                onChangeText={setResetEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar Link de Recuperação</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => {
                setShowForgotPassword(false);
                setResetEmail('');
              }}
              disabled={resetLoading}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textGray }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  themeToggle: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    zIndex: 10,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  logoHighlight: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.tabBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textGray,
  },
  activeTabText: {
    color: colors.textDark,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  inputLabel: {
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
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textGray,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
