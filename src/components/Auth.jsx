import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';


// --- Cognito Configuration ---
const poolData = {
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_APP_CLIENT_ID
};

const userPool = new CognitoUserPool(poolData);

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return PASSWORD_REGEX.test(password);
};

const validateUsername = (username) => {
  return username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
};

// --- Enhanced InputField Component ---
const InputField = React.forwardRef(({
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
}, ref) => (
  <div className="auth-input-group">
    <div className={`auth-input-wrapper ${error ? 'error' : ''} ${readOnly ? 'readonly' : ''}`}>
      {icon && <div className="auth-input-icon">{icon}</div>}
      <input
        ref={ref}
        type={showToggle && isPasswordVisible ? 'text' : type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        readOnly={readOnly}
        className={`auth-input ${icon ? 'with-icon' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {showToggle && (
        <button
          type="button"
          className="auth-password-toggle"
          onClick={onToggleVisibility}
          aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
        >
          {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
        </button>
      )}
    </div>
    {error && (
      <span id={`${name}-error`} className="auth-error-text" role="alert">
        {error}
      </span>
    )}
  </div>
));

function Auth({ onLoginSuccess }) {
  // State management
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    verificationCode: '',
    resetCode: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [uiState, setUiState] = useState({
    currentView: 'login', // 'login', 'signup', 'verification', 'forgotPassword'
    isLoading: false,
    resetCodeSent: false,
    showPassword: false,
    showNewPassword: false,
    showConfirmPassword: false
  });

  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Refs for focus management
  const focusRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (focusRef.current) {
      setTimeout(() => focusRef.current.focus(), 100);
    }
  }, [uiState.currentView]);

  // Clear messages when switching views
  useEffect(() => {
    setAuthError('');
    setSuccessMessage('');
    setErrors({});
  }, [uiState.currentView]);

  // Generic form data handler
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Clear general auth error
    if (authError) {
      setAuthError('');
    }
  }, [errors, authError]);

  // Password visibility toggle handler
  const handleToggleVisibility = (field) => {
    setUiState(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Validation function
  const validateForm = useCallback((view) => {
    const newErrors = {};

    switch (view) {
      case 'login':
        if (!formData.username.trim()) {
          newErrors.username = 'Username is required';
        }
        if (!formData.password) {
          newErrors.password = 'Password is required';
        }
        break;

      case 'signup':
        if (!validateUsername(formData.username)) {
          newErrors.username = 'Username must be at least 3 characters and contain only letters, numbers, and underscores';
        }
        if (!validateEmail(formData.email)) {
          newErrors.email = 'Please enter a valid email address';
        }
        if (!validatePassword(formData.password)) {
          newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
        }
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
        break;

      case 'verification':
        if (!formData.verificationCode.trim()) {
          newErrors.verificationCode = 'Verification code is required';
        }
        break;

      case 'resetPassword':
        if (!formData.resetCode.trim()) {
          newErrors.resetCode = 'Reset code is required';
        }
        if (!validatePassword(formData.newPassword)) {
          newErrors.newPassword = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Set loading state helper
  const setLoading = useCallback((loading) => {
    setUiState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  // Authentication handlers
  const handleLogin = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm('login')) return;

    setLoading(true);
    setAuthError('');

    try {
      const authDetails = new AuthenticationDetails({
        Username: formData.username.trim(),
        Password: formData.password
      });

      const cognitoUser = new CognitoUser({
        Username: formData.username.trim(),
        Pool: userPool
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
          setSuccessMessage('Login successful!');
          setTimeout(() => onLoginSuccess(cognitoUser), 500);
        },
        onFailure: (err) => {
          setLoading(false);
          if (err.code === 'UserNotConfirmedException') {
            setUiState(prev => ({ ...prev, currentView: 'verification' }));
            setAuthError('Please verify your account. A new verification code will be sent.');
            handleResendCode();
          } else {
            setAuthError(err.message || 'Login failed. Please try again.');
          }
        }
      });
    } catch (error) {
      setLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
    }
  }, [formData, validateForm, onLoginSuccess]);

  const handleSignup = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm('signup')) return;

    setLoading(true);
    setAuthError('');

    try {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: formData.email.trim().toLowerCase()
        })
      ];

      userPool.signUp(
        formData.username.trim(),
        formData.password,
        attributeList,
        null,
        (err, result) => {
          setLoading(false);
          if (err) {
            setAuthError(err.message || 'Signup failed. Please try again.');
            return;
          }

          setSuccessMessage('Account created successfully! Please check your email for verification code.');
          setUiState(prev => ({ ...prev, currentView: 'verification' }));
        }
      );
    } catch (error) {
      setLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
    }
  }, [formData, validateForm]);

  const handleVerification = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm('verification')) return;

    setLoading(true);
    setAuthError('');

    try {
      const cognitoUser = new CognitoUser({
        Username: formData.username.trim(),
        Pool: userPool
      });

      cognitoUser.confirmRegistration(formData.verificationCode.trim(), true, (err) => {
        setLoading(false);
        if (err) {
          setAuthError(err.message || 'Verification failed. Please try again.');
          return;
        }

        setSuccessMessage('Account verified successfully! You can now log in.');
        setTimeout(() => {
          setUiState(prev => ({ ...prev, currentView: 'login' }));
          setFormData(prev => ({ ...prev, verificationCode: '', password: '' }));
        }, 2000);
      });
    } catch (error) {
      setLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
    }
  }, [formData, validateForm]);

  const handleResendCode = useCallback(() => {
    if (!formData.username.trim()) {
      setAuthError('Username is required to resend code');
      return;
    }

    setAuthError('');
    const cognitoUser = new CognitoUser({
      Username: formData.username.trim(),
      Pool: userPool
    });

    cognitoUser.resendConfirmationCode((err) => {
      if (err) {
        setAuthError(err.message || 'Failed to resend code. Please try again.');
        return;
      }
      setSuccessMessage('A new verification code has been sent to your email.');
    });
  }, [formData.username]);

  const handleForgotPasswordRequest = useCallback(async (e) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      setErrors({ username: 'Username is required' });
      return;
    }

    setLoading(true);
    setAuthError('');

    try {
      const cognitoUser = new CognitoUser({
        Username: formData.username.trim(),
        Pool: userPool
      });

      cognitoUser.forgotPassword({
        onSuccess: () => {
          setLoading(false);
          setSuccessMessage('Reset code sent to your email.');
          setUiState(prev => ({ ...prev, resetCodeSent: true }));
        },
        onFailure: (err) => {
          setLoading(false);
          setAuthError(err.message || 'Failed to send reset code. Please try again.');
        }
      });
    } catch (error) {
      setLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
    }
  }, [formData.username]);

  const handleResetPasswordSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm('resetPassword')) return;

    setLoading(true);
    setAuthError('');

    try {
      const cognitoUser = new CognitoUser({
        Username: formData.username.trim(),
        Pool: userPool
      });

      cognitoUser.confirmPassword(formData.resetCode.trim(), formData.newPassword, {
        onSuccess: () => {
          setLoading(false);
          setSuccessMessage('Password reset successfully! You can now log in.');
          setTimeout(() => {
            setUiState(prev => ({
              ...prev,
              currentView: 'login',
              resetCodeSent: false
            }));
            setFormData(prev => ({
              ...prev,
              resetCode: '',
              newPassword: '',
              password: ''
            }));
          }, 2000);
        },
        onFailure: (err) => {
          setLoading(false);
          setAuthError(err.message || 'Password reset failed. Please try again.');
        }
      });
    } catch (error) {
      setLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
    }
  }, [formData, validateForm]);

  // View switching helpers
  const switchView = useCallback((view, additionalState = {}) => {
    setUiState(prev => ({
      ...prev,
      currentView: view,
      ...additionalState
    }));
  }, []);

  // Render functions
  const renderLoginForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">
          <h1 className="auth-app-title">AI Storyteller</h1>
        </div>
        <h2>Welcome Back</h2>
        <p>Sign in to continue your storytelling journey</p>
      </div>

      <form onSubmit={handleLogin} className="auth-form" noValidate>
        <InputField
          ref={focusRef}
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleInputChange}
          error={errors.username}
          required
          icon="👤"
        />

        <InputField
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleInputChange}
          error={errors.password}
          required
          showToggle
          isPasswordVisible={uiState.showPassword}
          onToggleVisibility={() => handleToggleVisibility('showPassword')}
          icon="🔒"
        />

        <button
          type="submit"
          className={`auth-submit-button ${uiState.isLoading ? 'loading' : ''}`}
          disabled={uiState.isLoading}
        >
          {uiState.isLoading ? (
            <>
              <span className="auth-spinner"></span>
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="auth-links">
        <button
          className="auth-link-button"
          onClick={() => switchView('forgotPassword')}
          disabled={uiState.isLoading}
        >
          Forgot Password?
        </button>
        <div className="auth-divider">
          <span>or</span>
        </div>
        <button
          className="auth-link-button secondary"
          onClick={() => switchView('signup')}
          disabled={uiState.isLoading}
        >
          Create New Account
        </button>
      </div>
    </div>
  );

  const renderSignupForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">
        
          <h1 className="auth-app-title">AI Storyteller</h1>
        </div>
        <h2>Create Account</h2>
        <p>Join our storytelling community</p>
      </div>

      <form onSubmit={handleSignup} className="auth-form" noValidate>
        <InputField
          ref={focusRef}
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleInputChange}
          error={errors.username}
          required
          icon="👤"
        />

        <InputField
          type="email"
          name="email"
          placeholder="Email Address"
          value={formData.email}
          onChange={handleInputChange}
          error={errors.email}
          required
          icon="📧"
        />

        <InputField
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleInputChange}
          error={errors.password}
          required
          showToggle
          isPasswordVisible={uiState.showPassword}
          onToggleVisibility={() => handleToggleVisibility('showPassword')}
          icon="🔒"
        />

        <InputField
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          error={errors.confirmPassword}
          required
          showToggle
          isPasswordVisible={uiState.showConfirmPassword}
          onToggleVisibility={() => handleToggleVisibility('showConfirmPassword')}
          icon="🔒"
        />

        <div className="auth-password-requirements">
          <small>
            Password must contain at least 8 characters with uppercase, lowercase, number, and special character.
          </small>
        </div>

        <button
          type="submit"
          className={`auth-submit-button ${uiState.isLoading ? 'loading' : ''}`}
          disabled={uiState.isLoading}
        >
          {uiState.isLoading ? (
            <>
              <span className="auth-spinner"></span>
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="auth-links">
        <span>Already have an account? </span>
        <button
          className="auth-link-button"
          onClick={() => switchView('login')}
          disabled={uiState.isLoading}
        >
          Sign In
        </button>
      </div>
    </div>
  );

  const renderVerificationForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">
          <div className="auth-logo-icon">📧</div>
          <h1 className="auth-app-title">AI Storyteller</h1>
        </div>
        <h2>Verify Your Account</h2>
        <p>We've sent a verification code to your email</p>
      </div>

      <form onSubmit={handleVerification} className="auth-form" noValidate>
        <InputField
          name="username"
          placeholder="Username"
          value={formData.username}
          readOnly
          icon="👤"
        />

        <InputField
          ref={focusRef}
          name="verificationCode"
          placeholder="Enter 6-digit code"
          value={formData.verificationCode}
          onChange={handleInputChange}
          error={errors.verificationCode}
          required
          icon="🔢"
        />

        <button
          type="submit"
          className={`auth-submit-button ${uiState.isLoading ? 'loading' : ''}`}
          disabled={uiState.isLoading}
        >
          {uiState.isLoading ? (
            <>
              <span className="auth-spinner"></span>
              Verifying...
            </>
          ) : (
            'Verify Account'
          )}
        </button>
      </form>

      <div className="auth-links">
        <span>Didn't receive the code? </span>
        <button
          className="auth-link-button"
          onClick={handleResendCode}
          disabled={uiState.isLoading}
        >
          Resend Code
        </button>
      </div>
    </div>
  );

  const renderForgotPasswordForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔑</div>
          <h1 className="auth-app-title">AI Storyteller</h1>
        </div>
        <h2>Reset Password</h2>
        <p>
          {!uiState.resetCodeSent
            ? 'Enter your username to receive a reset code'
            : 'Enter the code and your new password'
          }
        </p>
      </div>

      {!uiState.resetCodeSent ? (
        <form onSubmit={handleForgotPasswordRequest} className="auth-form" noValidate>
          <InputField
            ref={focusRef}
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleInputChange}
            error={errors.username}
            required
            icon="👤"
          />

          <button
            type="submit"
            className={`auth-submit-button ${uiState.isLoading ? 'loading' : ''}`}
            disabled={uiState.isLoading}
          >
            {uiState.isLoading ? (
              <>
                <span className="auth-spinner"></span>
                Sending Code...
              </>
            ) : (
              'Send Reset Code'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPasswordSubmit} className="auth-form" noValidate>
          <InputField
            name="username"
            placeholder="Username"
            value={formData.username}
            readOnly
            icon="👤"
          />

          <InputField
            ref={focusRef}
            name="resetCode"
            placeholder="Reset Code"
            value={formData.resetCode}
            onChange={handleInputChange}
            error={errors.resetCode}
            required
            icon="🔢"
          />

          <InputField
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleInputChange}
            error={errors.newPassword}
            required
            showToggle
            isPasswordVisible={uiState.showNewPassword}
            onToggleVisibility={() => handleToggleVisibility('showNewPassword')}
            icon="🔒"
          />

          <button
            type="submit"
            className={`auth-submit-button ${uiState.isLoading ? 'loading' : ''}`}
            disabled={uiState.isLoading}
          >
            {uiState.isLoading ? (
              <>
                <span className="auth-spinner"></span>
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      )}

      <div className="auth-links">
        <button
          className="auth-link-button"
          onClick={() => switchView('login', { resetCodeSent: false })}
          disabled={uiState.isLoading}
        >
          ← Back to Sign In
        </button>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="auth-wrapper">
      <div className="auth-background">
        <div className="auth-background-pattern"></div>
        <div className="auth-background-overlay"></div>
      </div>

      <div className="auth-content">
        {successMessage && (
          <div className="auth-success-message" role="alert">
            <span className="auth-success-icon">✅</span>
            {successMessage}
          </div>
        )}

        {authError && (
          <div className="auth-error-message" role="alert">
            <span className="auth-error-icon">⚠️</span>
            {authError}
          </div>
        )}

        <div className={`auth-form-container ${uiState.currentView}`}>
          {uiState.currentView === 'login' && renderLoginForm()}
          {uiState.currentView === 'signup' && renderSignupForm()}
          {uiState.currentView === 'verification' && renderVerificationForm()}
          {uiState.currentView === 'forgotPassword' && renderForgotPasswordForm()}
        </div>
      </div>
    </div>
  );
}

export default Auth;
