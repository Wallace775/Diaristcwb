import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { DiaristaItem } from '../types';

interface DiaristaMarkerProps {
  diarista: DiaristaItem;
  onPress?: (diarista: DiaristaItem) => void;
}

function DiaristaMarker({ diarista, onPress }: DiaristaMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const lat = diarista.latitude ? Number(diarista.latitude) : -25.4284;
  const lng = diarista.longitude ? Number(diarista.longitude) : -49.2733;

  return (
    <Marker
      key={diarista.id}
      coordinate={{ latitude: lat, longitude: lng }}
      tracksViewChanges={tracksViewChanges}
      onPress={() => onPress?.(diarista)}
    >
      <View style={styles.pinContainer}>
        <View style={styles.pinCircle}>
          {diarista.avatar_url ? (
            <Image
              source={{ uri: diarista.avatar_url }}
              style={styles.pinImage}
              onLoadEnd={() => {
                setTimeout(() => {
                  setTracksViewChanges(false);
                }, 500);
              }}
            />
          ) : (
            <View style={styles.pinFallback}>
              <Text style={styles.pinFallbackText}>
                {diarista.full_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.pinArrow} />
      </View>
    </Marker>
  );
}

export const REGIAO_CURITIBA = {
  latitude: -25.4284,
  longitude: -49.2733,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export interface MapaDiaristasRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

interface Props {
  busca: string;
  diaristas: DiaristaItem[];
  selectedCoords?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  } | null;
  showUserLocation?: boolean;
  onMarkerPress?: (diarista: DiaristaItem) => void;
}

const MapaDiaristas = forwardRef<MapaDiaristasRef, Props>(({ busca, diaristas, selectedCoords, showUserLocation, onMarkerPress }, ref) => {
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion(region: Region, duration = 500) {
      mapRef.current?.animateToRegion(region, duration);
    },
  }));

  useEffect(() => {
    if (selectedCoords) {
      const deltaLat = selectedCoords.latitudeDelta ?? 0.04;
      const deltaLng = selectedCoords.longitudeDelta ?? 0.04;
      if (deltaLat < 0.025 || deltaLng < 0.025) {
        mapRef.current?.animateToRegion({
          latitude: selectedCoords.latitude,
          longitude: selectedCoords.longitude,
          latitudeDelta: Math.max(deltaLat, 0.025),
          longitudeDelta: Math.max(deltaLng, 0.025),
        }, 400);
      } else {
        mapRef.current?.animateToRegion({
          latitude: selectedCoords.latitude,
          longitude: selectedCoords.longitude,
          latitudeDelta: deltaLat,
          longitudeDelta: deltaLng,
        }, 400);
      }
    }
  }, [selectedCoords]);

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={REGIAO_CURITIBA}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
      >
        {diaristas.map((diarista) => (
          <DiaristaMarker
            key={diarista.id}
            diarista={diarista}
            onPress={onMarkerPress}
          />
        ))}
      </MapView>
    </View>
  );
});

export default MapaDiaristas;

const styles = StyleSheet.create({
  mapContainer: {
    height: 220,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  pinContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
  },
  pinImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  pinFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinFallbackText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748b',
  },
  pinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2563eb',
  },
});
