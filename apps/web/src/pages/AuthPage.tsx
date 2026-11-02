import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authEmailSchema, loginSchema, passwordResetConfirmSchema, registrationSchema } from '@elsa3d/shared-validation';
import { Button, Input } from '@elsa3d/ui';
import { ApiError, api } from '../api.js';
import { useAuth } from '../auth.js';
import { useLocale } from '../i18n.js';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = useLocale();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (mode !== 'verify' || !token) return;
    api.verifyEmail(token).then(() => setVerified(true)).catch(() => setVerified(false));
  }, [mode, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (mode === 'verify') return;
    if (mode === 'login' || mode === 'register') {
      const schema = mode === 'login' ? loginSchema : registrationSchema;
      if (!schema.safeParse({ email, password }).success) {
        setError(!authEmailSchema.safeParse(email).success ? t('invalidEmail') : t('invalidPassword'));
        return;
      }
    }
    if (mode === 'forgot' && !authEmailSchema.safeParse(email).success) {
      setError(t('invalidEmail'));
      return;
    }
    if (mode === 'reset') {
      if (!passwordResetConfirmSchema.safeParse({ token, password }).success) {
        setError(t('invalidPassword'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('passwordMismatch'));
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/account');
      } else if (mode === 'register') {
        await api.register(email, password);
        setMessage(t('emailVerification'));
      } else if (mode === 'forgot') {
        await api.requestPasswordReset(email);
        setMessage(t('resetRequested'));
      } else if (mode === 'reset') {
        await api.confirmPasswordReset(token, password);
        setMessage(t('passwordResetSuccess'));
      }
    } catch (submitError) {
      const apiError = submitError instanceof ApiError ? submitError : null;
      setError(apiError?.status === 401 ? t('invalidCredentials') : apiError?.message ?? t('loadError'));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'login' ? t('login') : mode === 'register' ? t('register') : mode === 'forgot' ? t('forgotPassword') : mode === 'reset' ? t('passwordResetTitle') : t('verificationTitle');

  if (mode === 'verify') {
    return <main className="page-shell auth-page"><section className="auth-panel"><p className="section-heading__eyebrow">Namaa / نماء</p><h1>{title}</h1><p role="status">{verified ? t('verificationSuccess') : token ? t('verificationError') : t('verificationMissing')}</p>{verified ? <Link className="button-link button-link--green" to="/login">{t('login')}</Link> : <Link to="/register">{t('register')}</Link>}</section></main>;
  }

  return (
    <main className="page-shell auth-page">
      <section className="auth-panel">
        <p className="section-heading__eyebrow">Namaa / نماء</p>
        <h1>{title}</h1>
        <p className="auth-panel__intro">{mode === 'login' ? t('loginIntro') : mode === 'register' ? t('registerIntro') : mode === 'forgot' ? t('forgotIntro') : t('resetIntro')}</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          {mode !== 'reset' ? <Input label={t('email')} name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /> : null}
          {mode === 'login' || mode === 'register' || mode === 'reset' ? <Input label={t('password')} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} hint={mode !== 'login' ? t('passwordHint') : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} /> : null}
          {mode === 'reset' ? <Input label={t('confirmPassword')} name="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /> : null}
          {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
          {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
          <Button type="submit" size="large" loading={busy}>{mode === 'reset' ? t('completeReset') : mode === 'forgot' ? t('submit') : mode === 'register' ? t('register') : t('login')}</Button>
        </form>
        <div className="auth-panel__links">
          {mode === 'login' ? <><Link to="/forgot-password">{t('forgotPassword')}</Link><p>{t('noAccount')} <Link to="/register">{t('register')}</Link></p></> : null}
          {mode === 'register' ? <p>{t('hasAccount')} <Link to="/login">{t('login')}</Link></p> : null}
          {mode === 'forgot' || mode === 'reset' ? <Link to="/login">{t('login')}</Link> : null}
        </div>
      </section>
    </main>
  );
}
