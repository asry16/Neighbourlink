/** A place from the city search (Open-Meteo geocoder). */
export interface PlaceResult {
  id: number;
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
}
