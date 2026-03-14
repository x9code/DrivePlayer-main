import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// --- Keep Server Alive (prevent Render cold starts) ---
const API_BASE = import.meta.env.VITE_API_URL || '';
function keepServerAlive() {
  fetch(`${API_BASE}/`, { method: 'GET', cache: 'no-store' }).catch(() => { });
}
// Ping immediately, then every 10 minutes
keepServerAlive();
setInterval(keepServerAlive, 10 * 60 * 1000);

// --- Hide initial loader when React mounts ---
function hideInitialLoader() {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
    hideInitialLoader();
  }

  render() {
    if (this.state.hasError) {
      hideInitialLoader();
      return (
        <div style={{ padding: '2rem', color: '#ff5555', background: '#121212', height: '100vh', overflow: 'auto', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>Application Crashed</h1>
          <h2 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>{this.state.error?.toString()}</h2>
          <details style={{ whiteSpace: 'pre-wrap', color: '#aaa', background: '#000', padding: '1rem', borderRadius: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem', color: '#888' }}>Stack Trace</summary>
            {this.state.errorInfo?.componentStack}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '2rem', padding: '0.5rem 1rem', background: '#fff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Hide loader after React renders
hideInitialLoader();

