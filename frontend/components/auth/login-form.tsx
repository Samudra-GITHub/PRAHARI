'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, TriangleAlert, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mirrors the backend's own LoginBody zod schema
// (backend/src/lib/validators.ts): a valid email, password 8-128 chars.
// Validating here just saves a round trip — the backend still enforces it.
const PASSWORD_MIN = 8;

type FieldErrors = { email?: string; password?: string };

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < PASSWORD_MIN) errors.password = `Must be at least ${PASSWORD_MIN} characters.`;

  return errors;
}

// The error line is always in the layout, so showing/hiding it never shifts
// the fields below it. Without this, validating on blur moves the submit
// button between mousedown and mouseup and the click gets swallowed.
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <span id={`${id}-error`} role={error ? 'alert' : undefined} className="text-caption min-h-4 text-danger">
        {error ?? ''}
      </span>
    </div>
  );
}

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Errors only appear once a field has been left or the form submitted —
  // no scolding the user mid-typing.
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const errorFor = (field: keyof FieldErrors) => (touched[field] ? fieldErrors[field] : undefined);

  function handleBlur(field: keyof FieldErrors) {
    setTouched((t) => ({ ...t, [field]: true }));
    setFieldErrors(validate(email, password));
  }

  function handleChange(field: keyof FieldErrors, value: string) {
    const nextEmail = field === 'email' ? value : email;
    const nextPassword = field === 'password' ? value : password;
    if (field === 'email') setEmail(value);
    else setPassword(value);
    // Re-validate as they type only for fields already flagged, so an error
    // clears the moment it's fixed.
    if (touched.email || touched.password) setFieldErrors(validate(nextEmail, nextPassword));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const errors = validate(email, password);
    setFieldErrors(errors);
    setTouched({ email: true, password: true });
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      // POST /api/auth/login, then GET /api/auth/me — see AuthProvider.login.
      await login({ email, password });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      {formError && (
        <div
          role="alert"
          className="text-caption mb-2 flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger/10 px-3 py-2.5 text-danger"
        >
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}

      <Field id="email" label="Email" error={errorFor('email')}>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            placeholder="name@department.gov.in"
            disabled={submitting}
            aria-invalid={Boolean(errorFor('email'))}
            aria-describedby="email-error"
            className="pl-9"
          />
        </div>
      </Field>

      <Field id="password" label="Password" error={errorFor('password')}>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            placeholder="••••••••"
            disabled={submitting}
            aria-invalid={Boolean(errorFor('password'))}
            aria-describedby="password-error"
            className="pl-9"
          />
        </div>
      </Field>

      <Button type="submit" size="lg" disabled={submitting} className="mt-2 w-full">
        {submitting && <Loader2 className="animate-spin" aria-hidden />}
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
