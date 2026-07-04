import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, StyleSheet, Linking } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreenCliente from './src/screens/HomeScreenCliente';
import HomeScreenDiarista from './src/screens/HomeScreenDiarista';
import { UserSession, UserType } from './src/types';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { supabase } from './src/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [userSession, setUserSession] = useState<UserSession>({
    loggedIn: false,
    type: null,
  });
  const [appIsReady, setAppIsReady] = useState(false);
  const [showResetPasswordForm, setShowResetPasswordForm] = useState(false);

  useEffect(() => {
    const handleDeepLink = async (url: string | null) => {
      if (!url || !url.includes('redefinir-senha')) return;

      try {
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;

        const fragment = url.substring(hashIndex + 1);
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
            setUserSession({ loggedIn: false, type: null });
          }
        }
      } catch (err) {
        console.error('Erro ao processar deep link:', err);
      }
    };

    Linking.getInitialURL().then(handleDeepLink);

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        const [userResult] = await Promise.all([
          supabase.auth.getUser(),
          new Promise(resolve => setTimeout(resolve, 800)),
        ]);

        if (userResult?.data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('id', userResult.data.user.id)
            .single();

          if (profile) {
            setUserSession({ loggedIn: true, type: profile.user_type as UserType });
          }
        }
      } catch {
        // No session or error — stay logged out
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  const handleAuthSuccess = (type: UserType) => {
    setUserSession({ loggedIn: true, type });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserSession({ loggedIn: false, type: null });
  };

  if (!appIsReady) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('./assets/splash-logo.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.rootContainer} onLayout={onLayoutRootView}>
      <ThemeProvider>
        {userSession.loggedIn ? (
          userSession.type === 'diarista' ? (
            <HomeScreenDiarista onLogout={handleLogout} />
          ) : (
            <HomeScreenCliente onLogout={handleLogout} />
          )
        ) : (
          <AuthScreen
              onAuthSuccess={handleAuthSuccess}
              showResetPasswordForm={showResetPasswordForm}
              onResetComplete={() => setShowResetPasswordForm(false)}
            />
        )}
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: 250,
    height: 250,
  },
});
