import React, { useState, useEffect } from 'react';
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import Auth from './components/Auth';
import StorytellerApp from './components/StorytellerApp';
import './App.css';
import { useTheme } from './contexts/ThemeContext.jsx';

const poolData = {
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_APP_CLIENT_ID
};

const userPool = new CognitoUserPool(poolData);

function AppContent() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const cognitoUser = userPool.getCurrentUser();
        
        if (cognitoUser) {
          await new Promise((resolve, reject) => {
            cognitoUser.getSession((err, session) => {
              if (err) {
                console.error('Session error:', err);
                reject(err);
                return;
              }
              
              if (session && session.isValid()) {
                setUser(cognitoUser);
                resolve(session);
              } else {
                reject(new Error('Invalid session'));
              }
            });
          });
        }
      } catch (error) {
        console.error('Failed to restore user session:', error);
        setSessionError('Session expired. Please log in again.');
        if (user) user.signOut();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();
  }, []);

  const handleLoginSuccess = (cognitoUser) => {
    setUser(cognitoUser);
    setSessionError('');
  };

  const handleLogout = () => {
    if (user) user.signOut();
    setUser(null);
    setSessionError('');
    localStorage.clear();
    sessionStorage.clear();
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {sessionError && (
        <div className="session-error-banner">
          <span>{sessionError}</span>
          <button 
            onClick={() => setSessionError('')}
            className="error-close-button"
            aria-label="Close error message"
          >
            ×
          </button>
        </div>
      )}

      {user ? (
        <StorytellerApp 
          user={user} 
          onLogout={handleLogout}
        />
      ) : (
        <Auth onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default AppContent;
