import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { getAuthApiBase } from '../lib/authApi';
import { usePlatform } from '../state/PlatformContext';

function errorMessage(code: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Invalid email or password.';
    case 'account_disabled':
      return 'This account is disabled.';
    case 'auth_unavailable':
      return 'Sign-in service is temporarily unavailable. Try again shortly.';
    case 'network_error':
      return 'Could not reach the sign-in service. Check your network and that the auth server is running.';
    case 'missing_auth_url':
      return 'This app is missing VITE_AUTH_API_URL. Copy web/.env.example to web/.env and set the auth service URL.';
    case 'unknown_role':
      return 'Your account has a role this app does not recognize yet.';
    case 'malformed_auth_response':
      return 'The sign-in service returned an unexpected response.';
    default:
      return 'Sign-in failed. Try again.';
  }
}

export function LoginPage() {
  const { loginWithCredentials, resetLocalData } = usePlatform();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configured = Boolean(getAuthApiBase());

  const handleSignIn = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await loginWithCredentials(email.trim(), password);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      navigate('/app', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-100/40 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-2 max-w-md text-sm text-ink-600">
          Use the email and password stored in Cloud SQL. Course data in this app still lives in your
          browser until you connect a courses API.
        </p>
      </div>
      <Card className="w-full max-w-md">
        {!configured && (
          <p className="mb-4 rounded-lg bg-coral/10 px-3 py-2 text-sm text-ink-800">
            {errorMessage('missing_auth_url')}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-800">{error}</p>
        )}
        <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          className="mt-2 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="mt-6 block text-xs font-medium uppercase tracking-wide text-ink-500">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-900 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSignIn();
          }}
        />

        <Button
          className="mt-8 w-full"
          disabled={!configured || loading}
          onClick={() => void handleSignIn()}
        >
          {loading ? 'Signing in…' : 'Continue'}
        </Button>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          Authenticates against the auth microservice.
          <Badge tone="muted">JWT</Badge>
        </p>
      </Card>
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-ink-500 hover:text-ink-800"
        >
          ← Back home
        </button>
        <button
          type="button"
          className="text-xs text-ink-400 underline-offset-2 hover:text-ink-600 hover:underline"
          onClick={() => resetLocalData()}
        >
          Clear local data (browser storage)
        </button>
      </div>
    </div>
  );
}
