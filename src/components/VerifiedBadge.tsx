import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  showLabel?: boolean;
}

export default function VerifiedBadge({ size = 18, showLabel = false }: Props) {
  return (
    <View style={styles.container}>
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.check, { fontSize: size * 0.6 }]}>✓</Text>
      </View>
      {showLabel && <Text style={styles.label}>Verificado</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  check: {
    color: '#fff',
    fontWeight: 'bold',
    lineHeight: undefined,
  },
  label: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
});
