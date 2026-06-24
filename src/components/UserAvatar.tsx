import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../styles/theme';

interface Props {
  url: string | null;
  name: string;
  size?: number;
  onPress?: () => void;
}

export default function UserAvatar({ url, name, size = 54, onPress }: Props) {
  const [imageError, setImageError] = useState(false);
  const initial = name ? name.trim()[0].toUpperCase() : '?';

  const showFallback = !url || imageError;

  const content = showFallback ? (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  ) : (
    <Image
      source={{ uri: url }}
      onError={() => setImageError(true)}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    backgroundColor: colors.avatar,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: colors.white,
    fontWeight: 'bold',
  },
});
