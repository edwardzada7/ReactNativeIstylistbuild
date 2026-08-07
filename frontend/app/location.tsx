import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native'
import * as Location from 'expo-location'

export default function LocationScreen() {
  const [loading, setLoading] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [gpsUnavailable, setGpsUnavailable] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  const locate = async () => {
    setLoading(true)
    setPermissionDenied(false)
    setGpsUnavailable(false)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setPermissionDenied(true)
        return
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })
      if (pos && pos.coords) {
        setLatitude(pos.coords.latitude)
        setLongitude(pos.coords.longitude)
      } else {
        setGpsUnavailable(true)
      }
    } catch (err) {
      console.warn('Location error', err)
      setGpsUnavailable(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // attempt to locate on mount
    locate()
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Location (Phase 1 test)</Text>

      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator size="large" color="#ff3b8c" />
          <Text style={styles.loadingText}>Locating...</Text>
        </View>
      )}

      {!loading && permissionDenied && (
        <View style={styles.centerColumn}>
          <Text style={styles.errorText}>Location permission required.</Text>
          <Button title="Retry" onPress={locate} color="#ff3b8c" />
        </View>
      )}

      {!loading && gpsUnavailable && (
        <View style={styles.centerColumn}>
          <Text style={styles.errorText}>Unable to determine location.</Text>
          <Button title="Retry" onPress={locate} color="#ff3b8c" />
        </View>
      )}

      {!loading && !permissionDenied && !gpsUnavailable && (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Current Location</Text>
          <Text style={styles.infoText}>Latitude: {latitude ?? '—'}</Text>
          <Text style={styles.infoText}>Longitude: {longitude ?? '—'}</Text>
          <View style={styles.getButton}>
            <Button title="Get Location" onPress={locate} color="#ff3b8c" />
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  centerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 6,
  },
  getButton: {
    marginTop: 12,
  },
})
