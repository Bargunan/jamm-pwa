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

// Custom auto icon for providers
// Custom auto icon for providers (using data URI without btoa)
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

type Screen = 'splash' | 'onboarding' | 'map' | 'destination' | 'providers' | 'confirmation';

// Component to handle map updates when providers change
function MapUpdater({ providers }: { providers: Provider[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (providers.length > 0) {
      const bounds = providers.map(p => [p.latitude, p.longitude] as LatLngExpression);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [providers, map]);
  
  return null;
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProviderMovement, setShowProviderMovement] = useState(false);
  const movementInterval = useRef<NodeJS.Timeout | null>(null);

  // User location (Bangalore city center)
  const userLocation = { lat: 12.9716, lng: 77.5946 };

  // Fetch hotspots from Supabase
  useEffect(() => {
    fetchHotspots();
    fetchProviders();
  }, []);

  // Set up real-time subscription for provider updates
  useEffect(() => {
    const channel = supabase
      .channel('provider-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'providers'
        },
        (payload) => {
          console.log('Provider update:', payload);
          fetchProviders(); // Refresh providers on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Simulate provider movement for demo purposes
  useEffect(() => {
    if (showProviderMovement && providers.length > 0) {
      movementInterval.current = setInterval(() => {
        simulateProviderMovement();
      }, 3000); // Update every 3 seconds

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

  // Simulate provider movement (for demo)
  const simulateProviderMovement = async () => {
    try {
      // Update each provider's location slightly
      for (const provider of providers) {
        const latChange = (Math.random() - 0.5) * 0.002; // Small random movement
        const lngChange = (Math.random() - 0.5) * 0.002;
        
        const { error } = await supabase
          .from('providers')
          .update({
            latitude: provider.latitude + latChange,
            longitude: provider.longitude + lngChange
          })
          .eq('id', provider.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error simulating movement:', error);
    }
  };

  // Auto-advance from splash
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => setCurrentScreen('onboarding'), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const goToScreen = (screen: Screen) => {
    if (screen === 'map') {
      setShowProviderMovement(true); // Start movement simulation when on map
    } else {
      setShowProviderMovement(false); // Stop when leaving map
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

  // Splash Screen
  if (currentScreen === 'splash') {
    return (
      <div style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
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
        <div style={{ fontSize: '16px', opacity: 0.9 }}>Transparent, sustainable mobility for everyone</div>
      </div>
    );
  }

  // Onboarding Screen
  if (currentScreen === 'onboarding') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '30px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
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
              cursor: 'pointer',
              marginBottom: '12px'
            }}
          >Explore Without Login</button>
        </div>
      </div>
    );
  }

  // Map Screen with Real-Time Providers
  if (currentScreen === 'map') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Search Bar */}
        <div style={{
          position: 'absolute',
          top: '20px',
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

        {/* Real-time indicator */}
        <div style={{
          position: 'absolute',
          top: '80px',
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

        {/* Leaflet Map with Providers */}
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User Location */}
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Your Location</Popup>
          </Marker>

          {/* Hotspots */}
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

          {/* Real-Time Provider Markers */}
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

          {/* Route Lines (if provider has route data) */}
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

          <MapUpdater providers={providers} />
        </MapContainer>

        {/* Bottom Sheet */}
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
    );
  }

  // Destination Screen
  if (currentScreen === 'destination') {
    return (
      <div style={{ height: '100vh', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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
    );
  }

  // Provider List Screen
  if (currentScreen === 'providers') {
    return (
      <div style={{ height: '100vh', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', overflowY: 'auto' }}>
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
    );
  }

  // Confirmation Screen
  if (currentScreen === 'confirmation') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '30px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
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
    );
  }

  return null;
}

export default App;