import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, StyleSheet } from 'react-native';
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

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
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
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
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
