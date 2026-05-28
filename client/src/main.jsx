import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { SessionProvider } from './components/SessionProvider.jsx';
import { ToastProvider } from './components/Toast.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <SessionProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SessionProvider>
  </ErrorBoundary>
);
