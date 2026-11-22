import * as Location from 'expo-location';
import apiService from './api';

export type LocationResolutionError = 'permission-denied' | 'service-unavailable' | 'reverse-geocode-failed' | 'network-error' | 'unknown';

export interface LocationResolutionResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  location_address?: string | null;
  addressName?: string | null;
  error?: LocationResolutionError;
  message?: string;
}

const getReadableAddress = (addresses: Location.LocationGeocodedAddress[] | undefined): string | null => {
  const place = addresses?.[0];
  const parts = [place?.street, place?.name, place?.city, place?.region, place?.country].filter(Boolean) as string[];
  const compact = parts.join(', ').trim();
  return compact || null;
};

export async function resolveCurrentLocation(): Promise<LocationResolutionResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        success: false,
        error: 'permission-denied',
        message: 'Permission is required to use your current location.',
      };
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const geocoded = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    const locationAddress = getReadableAddress(geocoded) || 'Shared Location';
    return {
      success: true,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      location_address: locationAddress,
      addressName: locationAddress,
      message: locationAddress,
    };
  } catch (error: any) {
    const message = error?.message || '';
    if (/services/i.test(message) || /disabled/i.test(message)) {
      return {
        success: false,
        error: 'service-unavailable',
        message: 'Location services are currently unavailable.',
      };
    }

    if (/network/i.test(message) || /fetch/i.test(message)) {
      return {
        success: false,
        error: 'network-error',
        message: 'We could not reach the location service right now.',
      };
    }

    if (/reverse/i.test(message) || /geocode/i.test(message)) {
      return {
        success: false,
        error: 'reverse-geocode-failed',
        message: 'We could not resolve your address from the GPS coordinates.',
      };
    }

    return {
      success: false,
      error: 'unknown',
      message: 'We could not determine your location right now.',
    };
  }
}

export interface ServiceArea {
  id: number;
  country_code: string;
  region: string;
  city: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** The areas people can pick from (Lagos for now). */
export async function fetchAreas(): Promise<ServiceArea[]> {
  const res = await apiService.get<any>('/locations/areas');
  return res?.areas || [];
}

/** Nearest supported area for a GPS point, or null when the person is outside our launch area. */
export async function resolveArea(latitude: number, longitude: number): Promise<ServiceArea | null> {
  try {
    const res = await apiService.post<any>('/locations/resolve', { latitude, longitude });
    return res?.area || null;
  } catch {
    return null;
  }
}

/** The fields to save on the user record for a chosen area. */
export const areaFields = (a: ServiceArea) => ({ area_id: a.id, country_code: a.country_code, region: a.region, city: a.city });
