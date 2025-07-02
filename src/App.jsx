import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import AppContent from './AppContent';

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
