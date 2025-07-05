import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';

// --- Cognito Configuration ---
const poolData = {
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_APP_CLIENT_ID
};
const userPool = new CognitoUserPool(poolData);

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#])[A-Za-z\d@$!%*?&.#]{8,}$/;

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
const validatePassword = (password) => {
  return PASSWORD_REGEX.test(password);
};

// --- Enhanced InputField Component ---
const InputField = React.forwardRef(
  (
    {
      type = 'text',
      name,
      value,
      onChange,
      placeholder,
      required = false,
      readOnly = false,
      showToggle = false,
      isPasswordVisible,
      onToggleVisibility,
      icon = null,
      error = ''
    },
    ref
  ) => (
    <div className="auth-input-group">
      <div className={`auth-input-wrapper${error ? ' error' : ''}${readOnly ? ' readonly' : ''}`}>
        {icon && <span className="auth-input-icon">{icon}</span>}
        <input
          ref={ref}
          className={`auth-input${icon ? ' with-icon' : ''}`}
          type={showToggle && isPasswordVisible ? 'text' : type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          autoComplete={name}
        />
        {showToggle && (
          <button
            type="button"
            className="auth-password-toggle"
            onClick={onToggleVisibility}
            tabIndex={-1}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            {isPasswordVisible ? '🙈' : '👁️'}
          </button>
        )}
      </div>
      {error && <div className="auth-error-text">{error}</div>}
    </div>
  )
);

// --- Main Auth Component ---
function Auth({ onLoginSuccess }) {
  // UI state
  const [uiState, setUiState] = useState({
    mode: 'login', // 'login' | 'signup' | 'reset' | 'verify'
    resetCodeSent: false
  });

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Error/success state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Password visibility
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);

  // Verification state
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState('');

  // Refs for focus management
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    setError('');
    setSuccess('');
    setPassword('');
    setIsPasswordVisible(false);
    setIsNewPasswordVisible(false);
    setVerificationCode('');
    setNewPassword('');
    if (uiState.mode === 'login' && emailRef.current) emailRef.current.focus();
    if (uiState.mode === 'signup' && emailRef.current) emailRef.current.focus();
  }, [uiState.mode]);

  // --- Handlers ---
  const handleLogin = useCallback(
    (e) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (!validateEmail(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!validatePassword(password)) {
        setError(
          'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.'
        );
        return;
      }
      setLoading(true);
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password
      });
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          setLoading(false);
          setSuccess('Login successful!');
          onLoginSuccess && onLoginSuccess(cognitoUser);
        },
        onFailure: (err) => {
          setLoading(false);
          if (
            err.code === 'UserNotConfirmedException' ||
            (err.message && err.message.toLowerCase().includes('not confirmed'))
          ) {
            setPendingVerificationEmail(email);
            setPendingVerificationPassword(password);
            setUiState({ mode: 'verify' });
            setSuccess('Your account is not verified. Please enter the verification code sent to your email.');
            resendVerificationCode(email);
          } else {
            setError(err.message || 'Login failed.');
          }
        }
      });
    },
    [email, password, onLoginSuccess]
  );

  const handleSignUp = useCallback(
    (e) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (!validateEmail(email)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!validatePassword(password)) {
        setError(
          'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.'
        );
        return;
      }
      setLoading(true);
      userPool.signUp(
        email,
        password,
        [new CognitoUserAttribute({ Name: 'email', Value: email })],
        null,
        (err, result) => {
          setLoading(false);
          if (err) {
            if (
              err.code === 'UsernameExistsException' ||
              (err.message && err.message.toLowerCase().includes('already exists'))
            ) {
              setPendingVerificationEmail(email);
              setPendingVerificationPassword(password);
              setUiState({ mode: 'verify' });
              setSuccess('Account already exists but is not verified. Please enter the verification code sent to your email.');
              resendVerificationCode(email);
            } else {
              setError(err.message || 'Sign up failed.');
            }
            return;
          }
          setPendingVerificationEmail(email);
          setPendingVerificationPassword(password);
          setUiState({ mode: 'verify' });
          setSuccess('Sign up successful! Please enter the verification code sent to your email.');
        }
      );
    },
    [email, password]
  );

  const handleVerifyCode = useCallback(
    (e) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (!pendingVerificationEmail || !verificationCode) {
        setError('Please enter the verification code sent to your email.');
        return;
      }
      setLoading(true);
      const cognitoUser = new CognitoUser({
        Username: pendingVerificationEmail,
        Pool: userPool
      });
      cognitoUser.confirmRegistration(verificationCode, true, (err, result) => {
        setLoading(false);
        if (err) {
          setError(err.message || 'Verification failed.');
          return;
        }
        setSuccess('Verification successful! You can now log in.');
        setUiState({ mode: 'login', resetCodeSent: false });
        setEmail(pendingVerificationEmail);
        setPassword(pendingVerificationPassword);
        setPendingVerificationEmail('');
        setPendingVerificationPassword('');
        setVerificationCode('');
      });
    },
    [pendingVerificationEmail, verificationCode, pendingVerificationPassword]
  );

  const resendVerificationCode = useCallback(
    (emailToResend) => {
      if (!emailToResend) {
        setError('No email to resend code to.');
        return;
      }
      setLoading(true);
      const cognitoUser = new CognitoUser({
        Username: emailToResend,
        Pool: userPool
      });
      cognitoUser.resendConfirmationCode((err, result) => {
        setLoading(false);
        if (err) {
          setError(err.message || 'Failed to resend verification code.');
        } else {
          setSuccess('Verification code resent. Please check your email.');
        }
      });
    },
    []
  );

  const handleForgotPassword = useCallback(
    (e) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (!validateEmail(email)) {
        setError('Please enter your registered email address.');
        return;
      }
      setLoading(true);
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });
      cognitoUser.forgotPassword({
        onSuccess: () => {
          setLoading(false);
          setSuccess('A verification code has been sent to your email.');
          setUiState({ ...uiState, resetCodeSent: true });
        },
        onFailure: (err) => {
          setLoading(false);
          setError(err.message || 'Failed to send reset code.');
        }
      });
    },
    [email, uiState]
  );

  const handleResetPassword = useCallback(
    (e) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (!validateEmail(email)) {
        setError('Please enter your registered email address.');
        return;
      }
      if (!verificationCode) {
        setError('Please enter the verification code sent to your email.');
        return;
      }
      if (!validatePassword(newPassword)) {
        setError(
          'New password must be at least 8 characters, include uppercase, lowercase, number, and special character.'
        );
        return;
      }
      setLoading(true);
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });
      cognitoUser.confirmPassword(verificationCode, newPassword, {
        onSuccess: () => {
          setLoading(false);
          setSuccess('Password reset successful! You can now log in.');
          setUiState({ mode: 'login', resetCodeSent: false });
        },
        onFailure: (err) => {
          setLoading(false);
          setError(err.message || 'Failed to reset password.');
        }
      });
    },
    [email, verificationCode, newPassword]
  );

  // --- UI Render ---
  return (
    <div className="auth-wrapper">
      <div className="auth-content">
        <div className="auth-form-container">
          <div className="auth-container">
            <div className="auth-header">
              <div className="auth-logo">
                <span className="auth-logo-icon">✨</span>
                <span className="auth-app-title">Storyteller</span>
              </div>
              <h2>
                {uiState.mode === 'login'
                  ? 'Sign in to continue your storytelling journey'
                  : uiState.mode === 'signup'
                  ? 'Join our storytelling community'
                  : uiState.mode === 'verify'
                  ? 'Verify your email'
                  : 'Reset your password'}
              </h2>
              <p>
                {uiState.mode === 'login'
                  ? 'Welcome back! Please log in to your account.'
                  : uiState.mode === 'signup'
                  ? 'Create an account to start generating stories.'
                  : uiState.mode === 'verify'
                  ? 'Enter the verification code sent to your email.'
                  : uiState.resetCodeSent
                  ? "We've sent a verification code to your email"
                  : 'Enter your email to receive a reset code'}
              </p>
            </div>

            {error && <div className="auth-error-message"><span className="auth-error-icon">⚠️</span>{error}</div>}
            {success && <div className="auth-success-message"><span className="auth-success-icon">✅</span>{success}</div>}

            {uiState.mode === 'login' && (
              <form className="auth-form" onSubmit={handleLogin} autoComplete="on">
                <InputField
                  ref={emailRef}
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  icon="📧"
                  error=""
                />
                <InputField
                  ref={passwordRef}
                  type="password"
                  name="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  icon="🔒"
                  showToggle
                  isPasswordVisible={isPasswordVisible}
                  onToggleVisibility={() => setIsPasswordVisible(v => !v)}
                  error=""
                />
                <button
                  className={`auth-submit-button${loading ? ' loading' : ''}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <span className="auth-spinner" /> : 'Sign In'}
                </button>
              </form>
            )}

            {uiState.mode === 'signup' && (
              <form className="auth-form" onSubmit={handleSignUp} autoComplete="on">
                <InputField
                  ref={emailRef}
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  icon="📧"
                  error=""
                />
                <InputField
                  ref={passwordRef}
                  type="password"
                  name="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  icon="🔒"
                  showToggle
                  isPasswordVisible={isPasswordVisible}
                  onToggleVisibility={() => setIsPasswordVisible(v => !v)}
                  error=""
                />
                <div className="auth-password-requirements">
                  <small>
                    Password must be at least 8 characters, include uppercase, lowercase, number, and special character.
                  </small>
                </div>
                <button
                  className={`auth-submit-button${loading ? ' loading' : ''}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <span className="auth-spinner" /> : 'Sign Up'}
                </button>
              </form>
            )}

            {uiState.mode === 'verify' && (
              <form className="auth-form" onSubmit={handleVerifyCode} autoComplete="on">
                <InputField
                  type="text"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  placeholder="Verification Code"
                  required
                  icon="🔑"
                  error=""
                />
                <button
                  className={`auth-submit-button${loading ? ' loading' : ''}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <span className="auth-spinner" /> : 'Verify'}
                </button>
                <button
                  className="auth-link-button secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => resendVerificationCode(pendingVerificationEmail)}
                  style={{ marginTop: '1rem' }}
                >
                  Resend Code
                </button>
              </form>
            )}

            {uiState.mode === 'reset' && (
              <form
                className="auth-form"
                onSubmit={uiState.resetCodeSent ? handleResetPassword : handleForgotPassword}
                autoComplete="on"
              >
                <InputField
                  ref={emailRef}
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  icon="📧"
                  error=""
                  readOnly={uiState.resetCodeSent}
                />
                {uiState.resetCodeSent && (
                  <>
                    <InputField
                      type="text"
                      name="verificationCode"
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value)}
                      placeholder="Verification Code"
                      required
                      icon="🔑"
                      error=""
                    />
                    <InputField
                      type="password"
                      name="newPassword"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New Password"
                      required
                      icon="🔒"
                      showToggle
                      isPasswordVisible={isNewPasswordVisible}
                      onToggleVisibility={() => setIsNewPasswordVisible(v => !v)}
                      error=""
                    />
                    <div className="auth-password-requirements">
                      <small>
                        New password must be at least 8 characters, include uppercase, lowercase, number, and special character.
                      </small>
                    </div>
                  </>
                )}
                <button
                  className={`auth-submit-button${loading ? ' loading' : ''}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <span className="auth-spinner" /> : uiState.resetCodeSent ? 'Reset Password' : 'Send Code'}
                </button>
              </form>
            )}

            <div className="auth-links">
              {uiState.mode !== 'login' && (
                <button
                  className="auth-link-button"
                  type="button"
                  onClick={() => setUiState({ mode: 'login', resetCodeSent: false })}
                  disabled={loading}
                >
                  Already have an account? Sign In
                </button>
              )}
              {uiState.mode !== 'signup' && (
                <button
                  className="auth-link-button"
                  type="button"
                  onClick={() => setUiState({ mode: 'signup', resetCodeSent: false })}
                  disabled={loading}
                >
                  New here? Sign Up
                </button>
              )}
              {uiState.mode !== 'reset' && (
                <button
                  className="auth-link-button secondary"
                  type="button"
                  onClick={() => setUiState({ mode: 'reset', resetCodeSent: false })}
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
