
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  MapPin,
  Navigation,
  Users,
  Star,
  ArrowLeft,
  Search,
} from 'lucide-react';

// TypeScript interfaces
interface Location {
  lat: number;
  lng: number;
}

interface Hotspot {
  id: number;
  name: string;
  lat: number;
  lng: number;
  count: number;
  status: 'high' | 'medium' | 'low';
}

interface Provider {
  id: number;
  name: string;
  vehicle: string;
  rating: number;
  reviews: number;
  eta: number;
  seatsAvailable: number;
  fare: number;
}

const JammApp = () => {
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [, setUserLocation] = useState<Location | null>(null);
  const [selectedDestination, setSelectedDestination] = useState('');

  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => setCurrentScreen('onboarding'), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setUserLocation({ lat: 12.9716, lng: 77.5946 });
        }
      );
    } else {
      setUserLocation({ lat: 12.9716, lng: 77.5946 });
    }
  }, []);

  // Fetch hotspots from Supabase
useEffect(() => {
  async function fetchHotspots() {
    const { data, error } = await supabase
      .from('hotspots')
      .select('*');
    
    if (error) {
      console.error('Error fetching hotspots:', error);
      return;
    }
    
    if (data) {
      const formattedHotspots = data.map(h => ({
        id: h.id,
        name: h.name,
        lat: h.latitude,
        lng: h.longitude,
        count: h.provider_count,
        status: h.status as 'high' | 'medium' | 'low'
      }));
      setHotspots(formattedHotspots);
    }
  }
  
  fetchHotspots();
}, []);

// Fetch providers from Supabase
useEffect(() => {
  async function fetchProviders() {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('is_online', true);
    
    if (error) {
      console.error('Error fetching providers:', error);
      return;
    }
    
    if (data) {
      const formattedProviders = data.map(p => ({
        id: p.id,
        name: p.name,
        vehicle: p.vehicle_number,
        rating: p.rating,
        reviews: 234, // Mock for now
        eta: Math.floor(Math.random() * 10) + 1, // Mock ETA
        seatsAvailable: p.seats_available,
        fare: 45 // Mock fare
      }));
      setProviders(formattedProviders);
    }
  }
  
  fetchProviders();
}, []);

  const SplashScreen = () => (
    <div className="screen splash-screen">
      <div className="logo">J</div>
      <div className="tagline">Share the Ride</div>
      <div className="subtitle">
        Transparent, sustainable mobility for everyone
      </div>
    </div>
  );

  const OnboardingScreen = () => (
    <div className="screen onboarding-screen">
      <button className="skip-btn" onClick={() => setCurrentScreen('map')}>
        Skip
      </button>
      <div className="onboarding-content">
        <div className="feature-card">
          <MapPin size={36} />
          <h3>Real-time Transparency</h3>
          <p>See available seats, routes, and prices upfront</p>
        </div>
        <div className="feature-card">
          <Users size={36} />
          <h3>Community First</h3>
          <p>Share rides, reduce costs, make friends</p>
        </div>
        <div className="feature-card">
          <Navigation size={36} />
          <h3>Eco-Smart Travel</h3>
          <p>Reduce carbon footprint with shared mobility</p>
        </div>
      </div>
      <div className="cta-section">
        <button className="btn-primary" onClick={() => setCurrentScreen('map')}>
          Explore Without Login
        </button>
        <button
          className="btn-secondary"
          onClick={() => alert('Login with Phone + OTP coming soon!')}
        >
          Login / Sign Up
        </button>
      </div>
    </div>
  );

  const MapScreen = () => (
    <div className="screen map-screen">
      <div
        className="search-bar"
        onClick={() => setCurrentScreen('destination')}
      >
        <Search size={20} />
        <input type="text" placeholder="Where to?" readOnly />
      </div>

      <div className="map-container">
        <div
          className="user-marker"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="pulse-ring"></div>
          <div className="user-dot">📍</div>
        </div>

        {hotspots.map((hotspot, index) => (
          <div
            key={hotspot.id}
            className="hotspot-marker"
            style={{
              position: 'absolute',
              top: `${30 + index * 20}%`,
              left: `${40 + index * 15}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={() => setCurrentScreen('providers')}
          >
            <div className={`hotspot-badge ${hotspot.status}`}>
              <div className="hotspot-icon">🚕</div>
              <div className="hotspot-count">{hotspot.count}</div>
            </div>
            <div className="hotspot-label">{hotspot.name}</div>
          </div>
        ))}

        <div className="map-grid"></div>
      </div>

      <div className="bottom-sheet">
        <div className="sheet-handle"></div>
        <h3>Nearby Hotspots</h3>
        <p>Tap a hotspot or enter destination to see available rides</p>
        <div className="hotspot-list">
          {hotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              className="hotspot-item"
              onClick={() => setCurrentScreen('providers')}
            >
              <div className="hotspot-item-info">
                <span className={`status-dot ${hotspot.status}`}></span>
                <div>
                  <div className="hotspot-name">{hotspot.name}</div>
                  <div className="hotspot-distance">
                    {hotspot.count} autos available
                  </div>
                </div>
              </div>
              <div className="hotspot-arrow">→</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const DestinationScreen = () => (
    <div className="screen destination-screen">
      <div className="header">
        <button onClick={() => setCurrentScreen('map')} className="back-btn">
          <ArrowLeft size={24} />
        </button>
        <input
          type="text"
          placeholder="Search destination"
          className="destination-input"
          value={selectedDestination}
          onChange={(e) => setSelectedDestination(e.target.value)}
          autoFocus
        />
      </div>

      <div className="quick-access">
        <h4>Quick Access</h4>
        <div className="quick-buttons">
          <button onClick={() => setCurrentScreen('providers')}>🏠 Home</button>
          <button onClick={() => setCurrentScreen('providers')}>💼 Work</button>
          <button onClick={() => setCurrentScreen('providers')}>
            🎓 College
          </button>
        </div>
      </div>

      <div className="popular-destinations">
        <h4>Popular Destinations</h4>
        <div
          className="destination-item"
          onClick={() => setCurrentScreen('providers')}
        >
          <div>
            <strong>Koramangala</strong>
            <p>~15 mins • ₹40-50</p>
          </div>
          <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
        </div>
        <div
          className="destination-item"
          onClick={() => setCurrentScreen('providers')}
        >
          <div>
            <strong>Whitefield</strong>
            <p>~25 mins • ₹60-80</p>
          </div>
          <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
        </div>
        <div
          className="destination-item"
          onClick={() => setCurrentScreen('providers')}
        >
          <div>
            <strong>Electronic City</strong>
            <p>~30 mins • ₹80-100</p>
          </div>
          <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
        </div>
      </div>
    </div>
  );

  const ProvidersScreen = () => (
    <div className="screen providers-screen">
      <div className="header">
        <button
          onClick={() => setCurrentScreen('destination')}
          className="back-btn"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h3>MG Road → Koramangala</h3>
          <p>{providers.length} providers available</p>
        </div>
      </div>

      <div className="providers-list">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="provider-card"
            onClick={() => setCurrentScreen('confirmation')}
          >
            <div className="provider-header">
              <div className="provider-info">
                <h4>{provider.name}</h4>
                <p>{provider.vehicle}</p>
                <div className="rating">
                  <Star size={14} fill="#ffa500" color="#ffa500" />
                  <span>
                    {provider.rating} ({provider.reviews})
                  </span>
                </div>
              </div>
              <div className="provider-eta">
                <div className="eta-time">{provider.eta}</div>
                <div className="eta-label">mins away</div>
              </div>
            </div>
            <div className="provider-details">
              <div className="seats-info">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className={`seat-icon ${
                      i < provider.seatsAvailable ? 'available' : ''
                    }`}
                  >
                    {i < provider.seatsAvailable ? '✓' : '×'}
                  </div>
                ))}
                <span>{provider.seatsAvailable} seats left</span>
              </div>
              <div className="fare">₹{provider.fare}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ConfirmationScreen = () => (
    <div className="screen confirmation-screen">
      <div className="success-icon">✓</div>
      <h2>Ride Confirmed!</h2>
      <p className="confirmation-subtitle">Your seat has been reserved</p>

      <div className="trip-details">
        <div className="detail-row">
          <span>Driver</span>
          <strong>Ravi Kumar</strong>
        </div>
        <div className="detail-row">
          <span>Vehicle</span>
          <strong>KA-01-AB-1234</strong>
        </div>
        <div className="detail-row">
          <span>Pickup</span>
          <strong>MG Road Hotspot</strong>
        </div>
        <div className="detail-row">
          <span>Drop</span>
          <strong>Koramangala</strong>
        </div>
        <div className="detail-row">
          <span>ETA</span>
          <strong>2 minutes</strong>
        </div>
        <div className="detail-row">
          <span>Fare</span>
          <strong className="fare-amount">₹45</strong>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={() => alert('Live tracking coming soon!')}
      >
        <Navigation size={18} />
        Track Driver
      </button>
      <button className="btn-secondary" onClick={() => setCurrentScreen('map')}>
        Book Another Ride
      </button>
    </div>
  );

  return (
    <div className="app-container">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        .app-container {
          max-width: 480px;
          margin: 0 auto;
          height: 100vh;
          background: white;
          position: relative;
          overflow: hidden;
        }

        .screen {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .splash-screen {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          justify-content: center;
          align-items: center;
          padding: 40px;
        }

        .logo {
          width: 120px;
          height: 120px;
          background: white;
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 64px;
          font-weight: bold;
          color: #667eea;
          margin-bottom: 30px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .tagline {
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .subtitle {
          font-size: 16px;
          opacity: 0.9;
          text-align: center;
        }

        .onboarding-screen {
          padding: 30px;
        }

        .skip-btn {
          align-self: flex-end;
          padding: 8px 16px;
          background: #f0f0f0;
          border: none;
          border-radius: 20px;
          color: #666;
          cursor: pointer;
          font-size: 14px;
        }

        .onboarding-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 20px;
        }

        .feature-card {
          padding: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
        }

        .feature-card svg {
          margin-bottom: 12px;
        }

        .feature-card h3 {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .feature-card p {
          font-size: 14px;
          opacity: 0.9;
        }

        .cta-section {
          padding: 20px 0;
        }

        .btn-primary, .btn-secondary {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
        }

        .map-screen {
          position: relative;
          background: #f0f0f0;
        }

        .map-container {
          flex: 1;
          position: relative;
          background: linear-gradient(135deg, #e8f5e9 0%, #fff3e0 100%);
          overflow: hidden;
        }

        .map-grid {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        .search-bar {
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 1000;
          cursor: pointer;
        }

        .search-bar input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 16px;
          cursor: pointer;
          background: transparent;
        }

        .user-marker {
          z-index: 100;
        }

        .user-dot {
          width: 40px;
          height: 40px;
          background: #4285f4;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
          z-index: 2;
        }

        .pulse-ring {
          position: absolute;
          width: 60px;
          height: 60px;
          border: 3px solid #4285f4;
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }

        .hotspot-marker {
          cursor: pointer;
          z-index: 50;
        }

        .hotspot-badge {
          width: 70px;
          height: 70px;
          background: white;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          position: relative;
        }

        .hotspot-badge.high {
          border: 3px solid #4caf50;
        }

        .hotspot-badge.medium {
          border: 3px solid #ff9800;
        }

        .hotspot-badge.low {
          border: 3px solid #f44336;
        }

        .hotspot-icon {
          font-size: 24px;
        }

        .hotspot-count {
          font-size: 13px;
          font-weight: 600;
          color: #666;
        }

        .hotspot-label {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          font-size: 12px;
          font-weight: 600;
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          white-space: nowrap;
        }

        .bottom-sheet {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-radius: 20px 20px 0 0;
          padding: 20px;
          box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
          z-index: 1000;
          max-height: 45%;
          overflow-y: auto;
        }

        .sheet-handle {
          width: 40px;
          height: 4px;
          background: #ddd;
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        .bottom-sheet h3 {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .bottom-sheet p {
          color: #666;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .hotspot-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hotspot-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8f8f8;
          border-radius: 8px;
          cursor: pointer;
        }

        .hotspot-item-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .status-dot.high {
          background: #4caf50;
        }

        .status-dot.medium {
          background: #ff9800;
        }

        .status-dot.low {
          background: #f44336;
        }

        .hotspot-name {
          font-weight: 600;
          font-size: 14px;
        }

        .hotspot-distance {
          font-size: 12px;
          color: #666;
        }

        .hotspot-arrow {
          color: #999;
          font-size: 18px;
        }

        .destination-screen {
          padding: 20px;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .back-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #333;
          display: flex;
          align-items: center;
        }

        .destination-input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 16px;
          outline: none;
        }

        .quick-access, .popular-destinations {
          margin-bottom: 24px;
        }

        .quick-access h4, .popular-destinations h4 {
          font-size: 14px;
          color: #666;
          margin-bottom: 12px;
          font-weight: 600;
        }

        .quick-buttons {
          display: flex;
          gap: 10px;
        }

        .quick-buttons button {
          padding: 10px 16px;
          background: #f0f0f0;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }

        .destination-item {
          background: #f8f8f8;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .destination-item strong {
          display: block;
          margin-bottom: 4px;
          font-size: 16px;
        }

        .destination-item p {
          color: #666;
          font-size: 14px;
        }

        .providers-screen {
          padding: 20px;
          overflow-y: auto;
        }

        .header h3 {
          font-size: 18px;
          margin-bottom: 4px;
        }

        .header p {
          color: #666;
          font-size: 14px;
        }

        .providers-list {
          margin-top: 20px;
        }

        .provider-card {
          background: #f8f8f8;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
        }

        .provider-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .provider-info h4 {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .provider-info p {
          font-size: 14px;
          color: #666;
          margin-bottom: 4px;
        }

        .rating {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
          color: #666;
        }

        .provider-eta {
          text-align: right;
        }

        .eta-time {
          font-size: 24px;
          font-weight: 600;
          color: #667eea;
          line-height: 1;
        }

        .eta-label {
          font-size: 12px;
          color: #999;
        }

        .provider-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .seats-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .seat-icon {
          width: 24px;
          height: 24px;
          background: #e0e0e0;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .seat-icon.available {
          background: #4caf50;
          color: white;
        }

        .seats-info span {
          font-size: 14px;
          color: #666;
        }

        .fare {
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .confirmation-screen {
          padding: 40px 30px;
          align-items: center;
          justify-content: center;
        }

        .success-icon {
          width: 100px;
          height: 100px;
          background: #4caf50;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 48px;
          margin-bottom: 20px;
        }

        .confirmation-screen h2 {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .confirmation-subtitle {
          color: #666;
          margin-bottom: 30px;
        }

        .trip-details {
          width: 100%;
          background: #f8f8f8;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .detail-row:last-child {
          margin-bottom: 0;
          padding-top: 12px;
          border-top: 2px solid #e0e0e0;
        }

        .detail-row span {
          color: #666;
          font-size: 14px;
        }

        .detail-row strong {
          font-size: 14px;
        }

        .fare-amount {
          color: #667eea;
          font-size: 18px;
        }
      `}</style>

      {currentScreen === 'splash' && <SplashScreen />}
      {currentScreen === 'onboarding' && <OnboardingScreen />}
      {currentScreen === 'map' && <MapScreen />}
      {currentScreen === 'destination' && <DestinationScreen />}
      {currentScreen === 'providers' && <ProvidersScreen />}
      {currentScreen === 'confirmation' && <ConfirmationScreen />}
    </div>
  );
};

export default JammApp;
