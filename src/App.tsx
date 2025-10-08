import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import { Icon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from './supabaseClient';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom auto icon
const autoIcon = new Icon({
  iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#667eea" stroke="white" stroke-width="3"/>
      <path d="M 12 18 L 16 15 L 24 15 L 28 18 L 28 25 L 12 25 Z" fill="white"/>
      <circle cx="16" cy="25" r="2" fill="#333"/>
      <circle cx="24" cy="25" r="2" fill="#333"/>
      <rect x="14" y="18" width="12" height="5" fill="white" opacity="0.5"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

// Trichy center coordinates
const TRICHY_CENTER = { lat: 10.8155, lng: 78.7047 };
const TRICHY_RADIUS_KM = 15;

interface Hotspot {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  provider_count: number;
  status: string;
}

interface Provider {
  id: string;
  name: string;
  vehicle_number: string;
  latitude: number;
  longitude: number;
  seats_available: number;
  rating: number;
  is_online: boolean;
  current_route?: {
    pickup: { lat: number; lng: number; name: string };
    drop: { lat: number; lng: number; name: string };
  };
}

type Screen = 'checking' | 'blocked' | 'splash' | 'onboarding' | 'map' | 'destination' | 'providers' | 'confirmation';



// Component to recenter map on user location
function MapRecenter({ location }: { location: {lat: number, lng: number} | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (location) {
      map.setView([location.lat, location.lng], 14);
    }
  }, [location, map]);
  
  return null;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('checking');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProviderMovement, setShowProviderMovement] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
const [locationChecked, setLocationChecked] = useState(false);
const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
const movementInterval = useRef<number | null>(null);

// Get user's current location
const getUserLocation = () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        // Fallback to Trichy center if location fails
        setUserLocation(TRICHY_CENTER);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  } else {
    setUserLocation(TRICHY_CENTER);
  }
};

// Request location when map loads
useEffect(() => {
  if (currentScreen === 'map' && !userLocation) {
    getUserLocation();
  }
}, [currentScreen]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Check if user is in Trichy
const checkLocation = () => {
  // Check for demo mode in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const demoParam = urlParams.get('demo');
  
  // Check localStorage for saved demo mode
  const savedDemoMode = localStorage.getItem('jammDemoMode') === 'true';
  
  if (demoParam === 'true' || savedDemoMode) {
    if (demoParam === 'true') {
      localStorage.setItem('jammDemoMode', 'true');
    }
    setDemoMode(true);
    setLocationChecked(true);
    setCurrentScreen('splash');
    return;
  }

  // Request user location
  if ('geolocation' in navigator) {
    console.log('Requesting location permission...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('Got location:', latitude, longitude);
        
        const distance = calculateDistance(
          latitude,
          longitude,
          TRICHY_CENTER.lat,
          TRICHY_CENTER.lng
        );
        
        console.log('Distance from Trichy center:', distance, 'km');

        if (distance <= TRICHY_RADIUS_KM) {
          // User is in Trichy
          console.log('User is in Trichy! Granting access.');
          setLocationChecked(true);
          setCurrentScreen('splash');
        } else {
          // User is outside Trichy
          console.log('User is outside Trichy service area.');
          setLocationChecked(true);
          setCurrentScreen('blocked');
        }
      },
      (error) => {
        console.error('Location error:', error.message);
        console.log('Error code:', error.code);
        
        // Show blocked screen with helpful message based on error
        setLocationChecked(true);
        setCurrentScreen('blocked');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    console.error('Geolocation not supported');
    setLocationChecked(true);
    setCurrentScreen('blocked');
  }
};
  // Check location on mount
  useEffect(() => {
    checkLocation();
  }, []);

  // Fetch data
  useEffect(() => {
    if (locationChecked && currentScreen !== 'blocked') {
      fetchHotspots();
      fetchProviders();
    }
  }, [locationChecked, currentScreen]);

  // Real-time subscriptions
  useEffect(() => {
    if (currentScreen === 'blocked' || currentScreen === 'checking') return;

    const channel = supabase
      .channel('provider-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'providers'
        },
        () => {
          fetchProviders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentScreen]);

  // Provider movement simulation
  useEffect(() => {
    if (showProviderMovement && providers.length > 0) {
      movementInterval.current = setInterval(() => {
        simulateProviderMovement();
      }, 3000);

      return () => {
        if (movementInterval.current) {
          clearInterval(movementInterval.current);
        }
      };
    }
  }, [showProviderMovement, providers]);

  const fetchHotspots = async () => {
    try {
      const { data, error } = await supabase
        .from('hotspots')
        .select('*');
      
      if (error) throw error;
      if (data) setHotspots(data);
    } catch (error) {
      console.error('Error fetching hotspots:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('is_online', true);
      
      if (error) throw error;
      if (data) setProviders(data);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const simulateProviderMovement = async () => {
    try {
      for (const provider of providers) {
        const latChange = (Math.random() - 0.5) * 0.002;
        const lngChange = (Math.random() - 0.5) * 0.002;
        
        await supabase
          .from('providers')
          .update({
            latitude: provider.latitude + latChange,
            longitude: provider.longitude + lngChange
          })
          .eq('id', provider.id);
      }
    } catch (error) {
      console.error('Error simulating movement:', error);
    }
  };

  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => setCurrentScreen('onboarding'), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const goToScreen = (screen: Screen) => {
    if (screen === 'map') {
      setShowProviderMovement(true);
    } else {
      setShowProviderMovement(false);
    }
    setCurrentScreen(screen);
  };

  const bookRide = (provider: Provider) => {
    setSelectedProvider(provider);
    setCurrentScreen('confirmation');
  };

  const getHotspotColor = (status: string) => {
    switch (status) {
      case 'high': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'low': return '#f44336';
      default: return '#999';
    }
  };

  const enableDemoMode = () => {
    localStorage.setItem('jammDemoMode', 'true');
    setDemoMode(true);
    setCurrentScreen('splash');
  };

  const exitDemoMode = () => {
    localStorage.removeItem('jammDemoMode');
    setDemoMode(false);
    checkLocation();
  };

  // Checking Location Screen
  if (currentScreen === 'checking') {
    return (
      <div style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '30px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTop: '4px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ fontSize: '18px', marginTop: '20px' }}>Checking availability...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Blocked Screen (Outside Trichy)
  if (currentScreen === 'blocked') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden'
      }}>
        {/* Map showing Trichy */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={[TRICHY_CENTER.lat, TRICHY_CENTER.lng]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Circle
              center={[TRICHY_CENTER.lat, TRICHY_CENTER.lng]}
              radius={TRICHY_RADIUS_KM * 1000}
              pathOptions={{
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.2
              }}
            />
            <Marker position={[TRICHY_CENTER.lat, TRICHY_CENTER.lng]}>
              <Popup>
                <strong>Trichy Service Area</strong><br />
                Jamm is currently available here!
              </Popup>
            </Marker>
          </MapContainer>
          
          {/* Overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
            pointerEvents: 'none'
          }}></div>
        </div>

        {/* Bottom Sheet */}
        <div style={{
          background: 'white',
          borderRadius: '30px 30px 0 0',
          padding: '30px',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.2)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🗺️</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
              Jamm is Live in Trichy!
            </div>
            <div style={{ fontSize: '16px', color: '#666', lineHeight: '1.6' }}>
              We're starting with Trichy to deliver the best experience. More cities coming soon!
            </div>
          </div>

          <div style={{
            background: '#f8f8f8',
            padding: '15px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>📍</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>Currently Serving</div>
              <div style={{ fontSize: '14px', color: '#666' }}>Trichy, Tamil Nadu</div>
            </div>
          </div>

          <button
            onClick={enableDemoMode}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >
            🎮 Try Demo Version
          </button>

          <button
            style={{
              width: '100%',
              padding: '16px',
              background: '#f5f5f5',
              color: '#333',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📧 Notify Me When Available
          </button>

          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <a href="#" style={{ fontSize: '14px', color: '#667eea', textDecoration: 'none' }}>
              Want us in your city? →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Demo Mode Banner Component
  const DemoBanner = () => demoMode ? (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#fff3cd',
      padding: '10px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 2000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      fontSize: '14px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>ℹ️</span>
        <span><strong>Demo Mode</strong> - Jamm is live in Trichy</span>
      </div>
      <button
        onClick={exitDemoMode}
        style={{
          padding: '4px 12px',
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: '6px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        Exit Demo
      </button>
    </div>
  ) : null;

  // Splash Screen
  if (currentScreen === 'splash') {
    return (
      <>
        <DemoBanner />
        <div style={{
          height: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          paddingTop: demoMode ? '50px' : '0'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            background: 'white',
            borderRadius: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#667eea',
            marginBottom: '30px'
          }}>J</div>
          <div style={{ fontSize: '24px', fontWeight: 600, marginBottom: '10px' }}>Share the Ride</div>
          <div style={{ fontSize: '16px', opacity: 0.9 }}>Transparent, sustainable mobility in Trichy</div>
        </div>
      </>
    );
  }

  // Onboarding Screen
  if (currentScreen === 'onboarding') {
    return (
      <>
        <DemoBanner />
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '30px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          paddingTop: demoMode ? '80px' : '30px'
        }}>
          <button
            onClick={() => goToScreen('map')}
            style={{
              alignSelf: 'flex-end',
              padding: '8px 16px',
              background: '#f0f0f0',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer'
            }}
          >Skip</button>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
            {[
              { icon: '🗺️', title: 'Real-time Transparency', desc: 'See available seats, routes, and prices upfront' },
              { icon: '👥', title: 'Community First', desc: 'Share rides, reduce costs, make friends' },
              { icon: '🌱', title: 'Eco-Smart Travel', desc: 'Reduce carbon footprint with shared mobility' }
            ].map((feature, i) => (
              <div key={i} style={{
                padding: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '20px',
                color: 'white'
              }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>{feature.icon}</div>
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '5px' }}>{feature.title}</div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>{feature.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ paddingTop: '20px' }}>
            <button
              onClick={() => goToScreen('map')}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >Explore Without Login</button>
          </div>
        </div>
      </>
    );
  }

  // Map Screen
if (currentScreen === 'map') {
  const mapCenter = userLocation || TRICHY_CENTER;
  
  return (
    <>
      <DemoBanner />
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        paddingTop: demoMode ? '50px' : '0'
      }}>
        <div style={{
          position: 'absolute',
          top: demoMode ? '70px' : '20px',
          left: '20px',
          right: '20px',
          background: 'white',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          cursor: 'pointer'
        }} onClick={() => goToScreen('destination')}>
          <span>🔍</span>
          <span style={{ color: '#999' }}>Where to?</span>
        </div>

        {/* Locate Me Button */}
        <button
          onClick={getUserLocation}
          style={{
            position: 'absolute',
            bottom: '35%',
            right: '20px',
            width: '50px',
            height: '50px',
            background: 'white',
            border: 'none',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            cursor: 'pointer',
            zIndex: 1000
          }}
          title="Locate Me"
        >
          📍
        </button>

        <div style={{
          position: 'absolute',
          top: demoMode ? '130px' : '80px',
          right: '20px',
          background: '#4caf50',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
          Live Tracking
        </div>

        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User's Current Location Marker */}
          {userLocation && (
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={50}
              pathOptions={{
                color: '#4285f4',
                fillColor: '#4285f4',
                fillOpacity: 0.3
              }}
            >
              <Popup>
                <strong>You are here</strong><br />
                Your current location
              </Popup>
            </Circle>
          )}
          
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]}>
              <Popup>Your Location</Popup>
            </Marker>
          )}

          {hotspots.map((hotspot) => (
            <Circle
              key={hotspot.id}
              center={[hotspot.latitude, hotspot.longitude]}
              radius={150}
              pathOptions={{
                color: getHotspotColor(hotspot.status),
                fillColor: getHotspotColor(hotspot.status),
                fillOpacity: 0.3
              }}
            >
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong>{hotspot.name}</strong><br />
                  🚕 {hotspot.provider_count} autos available<br />
                  <button
                    onClick={() => goToScreen('providers')}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    See Rides
                  </button>
                </div>
              </Popup>
            </Circle>
          ))}

          {providers.map((provider) => (
            <Marker
              key={provider.id}
              position={[provider.latitude, provider.longitude]}
              icon={autoIcon}
            >
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <strong>{provider.name}</strong><br />
                  {provider.vehicle_number}<br />
                  ⭐ {provider.rating} | {provider.seats_available} seats<br />
                  <button
                    onClick={() => bookRide(provider)}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Book Now - ₹45
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {providers.map((provider) => {
            if (provider.current_route) {
              const route: LatLngExpression[] = [
                [provider.current_route.pickup.lat, provider.current_route.pickup.lng],
                [provider.latitude, provider.longitude],
                [provider.current_route.drop.lat, provider.current_route.drop.lng]
              ];
              return (
                <Polyline
                  key={`route-${provider.id}`}
                  positions={route}
                  pathOptions={{
                    color: '#667eea',
                    weight: 3,
                    opacity: 0.6,
                    dashArray: '10, 10'
                  }}
                />
              );
            }
            return null;
          })}

          <MapRecenter location={userLocation} />
        </MapContainer>

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'white',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
          maxHeight: '30%',
          zIndex: 1000
        }}>
          <div style={{ width: '40px', height: '4px', background: '#ddd', borderRadius: '2px', margin: '0 auto 20px' }}></div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>
            {providers.length} Autos Nearby
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {loading ? 'Loading...' : `Tap on auto icons to book instantly`}
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </>
  );
}

  // Destination Screen
  if (currentScreen === 'destination') {
    return (
      <>
        <DemoBanner />
        <div style={{ 
          height: '100vh', 
          padding: '20px', 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          paddingTop: demoMode ? '70px' : '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span onClick={() => goToScreen('map')} style={{ cursor: 'pointer', fontSize: '24px' }}>←</span>
            <input
              type="text"
              placeholder="Search destination"
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Quick Access</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['🏠 Home', '💼 Work', '🎓 College'].map((label, i) => (
                <button
                  key={i}
                  onClick={() => goToScreen('providers')}
                  style={{
                    padding: '10px 20px',
                    background: '#f0f0f0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Popular Destinations</div>
            {hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                onClick={() => goToScreen('providers')}
                style={{
                  padding: '15px',
                  background: '#f8f8f8',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 600 }}>{hotspot.name}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  ~15 mins • {hotspot.provider_count} providers
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Provider List Screen
  if (currentScreen === 'providers') {
    return (
      <>
        <DemoBanner />
        <div style={{ 
          height: '100vh', 
          padding: '20px', 
          fontFamily: 'system-ui, -apple-system, sans-serif', 
          overflowY: 'auto',
          paddingTop: demoMode ? '70px' : '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span onClick={() => goToScreen('destination')} style={{ cursor: 'pointer', fontSize: '24px' }}>←</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Available Rides</div>
              <div style={{ fontSize: '14px', color: '#666' }}>{providers.length} providers online</div>
            </div>
          </div>

          {providers.map((provider) => (
            <div
              key={provider.id}
              onClick={() => bookRide(provider)}
              style={{
                background: '#f8f8f8',
                borderRadius: '12px',
                padding: '15px',
                marginBottom: '12px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{provider.name}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>{provider.vehicle_number}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>⭐ {provider.rating}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: '#667eea' }}>₹45</div>
                  <div style={{ fontSize: '12px', color: '#4caf50' }}>● Live</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {provider.seats_available} {provider.seats_available === 1 ? 'seat' : 'seats'} available
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Confirmation Screen
  if (currentScreen === 'confirmation') {
    return (
      <>
        <DemoBanner />
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '30px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          paddingTop: demoMode ? '80px' : '30px'
        }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: '#4caf50',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '48px',
            marginBottom: '20px'
          }}>✓</div>

          <div style={{ fontSize: '24px', fontWeight: 600, marginBottom: '10px' }}>Ride Confirmed!</div>
          <div style={{ fontSize: '16px', color: '#666', textAlign: 'center', marginBottom: '30px' }}>
            Your seat has been reserved
          </div>

          {selectedProvider && (
            <div style={{
              width: '100%',
              background: '#f8f8f8',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>Driver</span>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{selectedProvider.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>Vehicle</span>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{selectedProvider.vehicle_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>Rating</span>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>⭐ {selectedProvider.rating}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666', fontSize: '14px' }}>Fare</span>
                <span style={{ fontWeight: 600, fontSize: '18px', color: '#667eea' }}>₹45</span>
              </div>
            </div>
          )}

          <button
            onClick={() => goToScreen('map')}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >Book Another Ride</button>
        </div>
      </>
    );
  }

  return null;
}

export default App;