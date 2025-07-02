import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';


// Professional icons using Unicode/Emoji
const Icons = {
  History: '📚',
  Create: '✨',
  Settings: '⚙️',
  Logout: '🚪',
  Menu: '☰',
  Close: '✕',
  NewStory: '+',
  Play: '▶️',
  Pause: '⏸️',
  Stop: '⏹️',
  Volume: '🔊',
  Download: '⬇️',
  Sun: '☀️',
  Moon: '🌙',
  Delete: '🗑️',
  LoadingSpinner: () => <div className="spinner" aria-label="Loading..."></div>,
};

// =================================================================================================
// Initial State & Constants
// =================================================================================================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const INITIAL_FORM_STATE = {
  story_name: '',
  story_theme: '', // Main prompt - COMPULSORY
  genre: 'Adventure',
  length: 200,
  voice: 'Aditi',
  rate: 'medium',
  character_name: '',
  character_traits: '',
  character_motivation: '',
  character_flaw: '',
  secondary_character_role: '',
  secondary_character_details: '',
  atmosphere: '',
  opening_scene: '',
  key_object: '',
  plot_twist: '',
};

// =================================================================================================
// Main App Component
// =================================================================================================
function StorytellerApp({ user, onLogout }) {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState('create');
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [currentStory, setCurrentStory] = useState(null);
  
  // App status states
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [error, setError] = useState('');

  // History state
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Mobile UI state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('storyteller-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Audio highlighting state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Refs
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('storyteller-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // --- DERIVED STATE & MEMOS ---
  const hasContentChanged = useMemo(() => {
    if (!currentStory) return false;
    return (
      formState.story_name !== currentStory.title ||
      formState.genre !== currentStory.genre ||
      formState.character_name !== currentStory.character_name ||
      formState.character_traits !== currentStory.character_traits ||
      formState.character_motivation !== currentStory.character_motivation ||
      formState.character_flaw !== currentStory.character_flaw ||
      formState.secondary_character_role !== currentStory.secondary_character_role ||
      formState.secondary_character_details !== currentStory.secondary_character_details ||
      formState.atmosphere !== currentStory.atmosphere ||
      formState.opening_scene !== currentStory.opening_scene ||
      formState.key_object !== currentStory.key_object ||
      formState.plot_twist !== currentStory.plot_twist ||
      formState.story_theme !== currentStory.story_theme ||
      formState.length !== currentStory.length
    );
  }, [formState, currentStory]);

  // --- AUDIO HIGHLIGHTING LOGIC ---
  const startAudioTracking = useCallback(() => {
    if (!audioRef.current || !currentStory?.text) return;

    const audio = audioRef.current;
    const words = currentStory.text.split(/\s+/);
    const totalWords = words.length;
    
    progressIntervalRef.current = setInterval(() => {
      if (audio.duration && audio.currentTime) {
        const progress = audio.currentTime / audio.duration;
        const wordIndex = Math.floor(progress * totalWords);
        
        setCurrentWordIndex(Math.min(wordIndex, totalWords - 1));
        setAudioProgress(progress * 100);
      }
    }, 100);
  }, [currentStory?.text]);

  const stopAudioTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setCurrentWordIndex(-1);
    setAudioProgress(0);
  }, []);

  // --- TOAST NOTIFICATION SYSTEM ---
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000); // Hide after 3 seconds
  };

  // --- API & DATA HANDLING ---
  const authenticatedFetch = useCallback(async (endpoint, options = {}) => {
    return new Promise((resolve, reject) => {
      user.getSession((err, session) => {
        if (err || !session.isValid()) {
          onLogout();
          return reject(new Error('Session invalid, please log out and log back in.'));
        }
        const token = session.getIdToken().getJwtToken();
        
        // Set proper headers based on method
        const headers = { 
          'Authorization': token,
          ...options.headers 
        };
        
        // Only add Content-Type for requests with body
        if (options.method !== 'DELETE' && options.method !== 'GET') {
          headers['Content-Type'] = 'application/json';
        }
        
        fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })
          .then(response => {
            if (!response.ok) {
              return response.text().then(text => {
                try {
                  const errorData = JSON.parse(text);
                  reject(new Error(errorData.error || response.statusText));
                } catch {
                  reject(new Error(text || response.statusText));
                }
              });
            }
            
            // Handle empty responses for DELETE
            if (response.status === 204 || response.headers.get('content-length') === '0') {
              return {};
            }
            
            return response.json();
          })
          .then(resolve)
          .catch(reject);
      });
    });
  }, [user, onLogout]);

  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setError('');
    try {
      const data = await authenticatedFetch('/history', { method: 'GET' });
      setHistory(data);
    } catch (err) {
      setError(`Failed to fetch history: ${err.message}`);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authenticatedFetch]);
  
  useEffect(() => {
    if (view === 'history') {
      fetchHistory();
    }
  }, [view, fetchHistory]);

  // --- EVENT HANDLERS ---
  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };
  
  const handleCreateNew = () => {
    setCurrentStory(null);
    setFormState(INITIAL_FORM_STATE);
    setError('');
    setIsMobileSidebarOpen(false);
    stopAudioTracking();
  };
  
  const handleViewFromHistory = (historyItem) => {
    setCurrentStory(historyItem);
    setFormState({
      story_name: historyItem.title,
      story_theme: historyItem.story_theme,
      genre: historyItem.genre,
      length: historyItem.length,
      voice: historyItem.voice,
      rate: historyItem.rate,
      character_name: historyItem.character_name || '',
      character_traits: historyItem.character_traits || '',
      character_motivation: historyItem.character_motivation || '',
      character_flaw: historyItem.character_flaw || '',
      secondary_character_role: historyItem.secondary_character_role || '',
      secondary_character_details: historyItem.secondary_character_details || '',
      atmosphere: historyItem.atmosphere || '',
      opening_scene: historyItem.opening_scene || '',
      key_object: historyItem.key_object || '',
      plot_twist: historyItem.plot_twist || '',
    });
    setView('create');
    setError('');
    setIsMobileSidebarOpen(false);
    stopAudioTracking();
  };
  
  const handleGenerateStory = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    stopAudioTracking();

    try {
      const data = await authenticatedFetch('/story', {
        method: 'POST',
        body: JSON.stringify(formState),
      });

      const newStoryObject = {
        ...formState,
        title: formState.story_name,
        text: data.story,
        audio_url: data.audio_url,
        id: data.audio_url.split('/').pop().split('?')[0].replace('.mp3', ''),
      };
      
      setCurrentStory(newStoryObject);
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsMobileSidebarOpen(false);
    }
  };
  
  const handleRegenerateAudio = async () => {
    if (!currentStory) return;
    setIsAudioLoading(true);
    setError('');
    stopAudioTracking();
    
    try {
      const data = await authenticatedFetch('/regenerate-audio', {
        method: 'POST',
        body: JSON.stringify({
          story_id: currentStory.id,
          voice: formState.voice,
          rate: formState.rate,
        }),
      });

      setCurrentStory(prev => ({
        ...prev,
        audio_url: data.audio_url,
        voice: formState.voice,
        rate: formState.rate,
      }));

      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAudioLoading(false);
      setIsMobileSidebarOpen(false);
    }
  };

  // Clean delete handler with toast notification instead of alert
  const handleDeleteStory = async (storyId, storyTitle) => {
    // Show confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${storyTitle}"?\n\nThis action cannot be undone and will permanently remove the story and its audio file.`
    );
    
    if (!confirmDelete) return;

    try {
      setError('');
      
      const response = await authenticatedFetch(`/story/${storyId}`, {
        method: 'DELETE',
      });
      
      // Immediately remove from UI state
      setHistory(prevHistory => prevHistory.filter(story => story.id !== storyId));
      
      // If the deleted story is currently displayed, clear it
      if (currentStory && currentStory.id === storyId) {
        setCurrentStory(null);
        setFormState(INITIAL_FORM_STATE);
        stopAudioTracking();
      }
      
      // Show toast notification instead of alert
      showToast(`Story "${storyTitle}" has been deleted successfully.`, 'success');
      
    } catch (err) {
      setError(`Failed to delete story: ${err.message}`);
      // If delete failed, refresh history to ensure UI is in sync
      fetchHistory();
    }
  };

  // Audio control handlers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      stopAudioTracking();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      startAudioTracking();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    stopAudioTracking();
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  // Enhanced audio seeking
  const handleProgressBarClick = (e) => {
    if (!audioRef.current || !audioDuration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const newTime = clickPercent * audioDuration;
    
    audioRef.current.currentTime = newTime;
    
    // Update word index based on new position
    if (currentStory?.text) {
      const words = currentStory.text.split(/\s+/);
      const totalWords = words.length;
      const wordIndex = Math.floor(clickPercent * totalWords);
      setCurrentWordIndex(Math.min(wordIndex, totalWords - 1));
      setAudioProgress(clickPercent * 100);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // =================================================================================================
  // RENDER METHOD
  // =================================================================================================
  return (
    <div className="storyteller-app">
      {/* Mobile Sidebar */}
      <div className={`mobile-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Story Settings</h3>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="close-btn">
            {Icons.Close}
          </button>
        </div>
        <div className="sidebar-content">
          <StoryForm
            formState={formState}
            currentStory={currentStory}
            isLoading={isLoading}
            isAudioLoading={isAudioLoading}
            hasContentChanged={hasContentChanged}
            onChange={handleFormChange}
            onSubmit={handleGenerateStory}
            onRegenerateAudio={handleRegenerateAudio}
            onCreateNew={handleCreateNew}
          />
        </div>
      </div>
      {isMobileSidebarOpen && <div className="overlay" onClick={() => setIsMobileSidebarOpen(false)} />}
      
      {/* Updated Header */}
      <Header 
        onLogout={onLogout} 
        isDarkMode={isDarkMode} 
        onToggleTheme={toggleTheme}
        view={view}
        setView={setView}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        handleCreateNew={handleCreateNew}
        currentStory={currentStory}
        isLoading={isLoading}
        isAudioLoading={isAudioLoading}
        hasContentChanged={hasContentChanged}
        onSubmit={handleGenerateStory}
        onRegenerateAudio={handleRegenerateAudio}
        onCreateNew={handleCreateNew}
      />

      {/* Updated Main Layout */}
      <main className="app-main">
        <aside className="desktop-sidebar">
          <StoryForm
            formState={formState}
            currentStory={currentStory}
            isLoading={isLoading}
            isAudioLoading={isAudioLoading}
            hasContentChanged={hasContentChanged}
            onChange={handleFormChange}
            onSubmit={handleGenerateStory}
            onRegenerateAudio={handleRegenerateAudio}
            onCreateNew={handleCreateNew}
          />
        </aside>

        <div className="content-area">
          {error && <div className="error-banner">{error}</div>}

          {view === 'create' ? (
            <StoryDisplay 
              story={currentStory} 
              isLoading={isLoading}
              audioRef={audioRef}
              isPlaying={isPlaying}
              currentWordIndex={currentWordIndex}
              audioProgress={audioProgress}
              audioDuration={audioDuration}
              onPlayPause={handlePlayPause}
              onAudioEnded={handleAudioEnded}
              onAudioLoadedMetadata={handleAudioLoadedMetadata}
              onProgressBarClick={handleProgressBarClick}
            />
          ) : (
            <HistoryView 
              history={history} 
              isLoading={isHistoryLoading} 
              onView={handleViewFromHistory}
              onDelete={handleDeleteStory}
              onCreateNew={() => { setView('create'); handleCreateNew(); }}
            />
          )}
        </div>
      </main>

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

// =================================================================================================
// Sub-Components
// =================================================================================================

const Header = ({ onLogout, isDarkMode, onToggleTheme, view, setView, setIsMobileSidebarOpen, handleCreateNew, currentStory, isLoading, isAudioLoading, hasContentChanged, onSubmit, onRegenerateAudio, onCreateNew }) => (
  <header className="app-header">
    <div className="header-content">
      <h1>🎭 AI Storyteller</h1>
      
      <div className="header-right-section">
        {/* Navigation in Header */}
        <nav className="header-navigation">
          <button 
            onClick={() => setView('create')} 
            className={`header-nav-btn ${view === 'create' ? 'active' : ''}`}
          >
            {Icons.Create} Create Story
          </button>
          <button 
            onClick={() => setView('history')} 
            className={`header-nav-btn ${view === 'history' ? 'active' : ''}`}
          >
            {Icons.History} History
          </button>
          <button 
            className="header-nav-btn mobile-settings-btn" 
            onClick={() => setIsMobileSidebarOpen(true)}
          >
            {Icons.Settings} Settings
          </button>
        </nav>

        <div className="header-actions">
          {/* Action Buttons in Header */}
          {currentStory && (
            <button onClick={onCreateNew} className="header-action-btn new-story-btn">
              {Icons.NewStory} New Story
            </button>
          )}
          
          {/* Main Action Button */}
          {!currentStory ? (
            <button onClick={onSubmit} disabled={isLoading} className="header-action-btn btn-primary">
              {isLoading ? <><Icons.LoadingSpinner /> Creating...</> : 'Create Story'}
            </button>
          ) : hasContentChanged ? (
            <button onClick={onSubmit} disabled={isLoading} className="header-action-btn btn-primary">
              {isLoading ? <><Icons.LoadingSpinner /> Regenerating...</> : 'Regenerate Story'}
            </button>
          ) : (
            <button onClick={onRegenerateAudio} disabled={isAudioLoading} className="header-action-btn btn-secondary">
              {isAudioLoading ? <><Icons.LoadingSpinner /> Updating Audio...</> : 'Update Audio Only'}
            </button>
          )}

          <button onClick={onToggleTheme} className="header-action-btn theme-toggle-btn" aria-label="Toggle theme">
            {isDarkMode ? Icons.Sun : Icons.Moon}
          </button>
          <button onClick={onLogout} className="header-action-btn logout-btn">
            {Icons.Logout} Logout
          </button>
        </div>
      </div>
    </div>
  </header>
);

const StoryForm = ({ formState, currentStory, isLoading, isAudioLoading, hasContentChanged, onChange, onSubmit, onRegenerateAudio, onCreateNew }) => {
  // Reordered form fields with compulsory ones at top
  const compulsoryFields = [
    { name: 'story_name', label: 'Story Name', placeholder: 'The Lost City of Zym', required: true },
    { 
      name: 'story_theme', 
      label: 'Story Theme/Plot', 
      type: 'textarea', 
      required: true, 
      placeholder: 'An explorer seeks a rare flower that can cure any disease...' 
    },
  ];

  const basicFields = [
    { 
      name: 'genre', 
      label: 'Genre', 
      type: 'select', 
      options: ['Adventure', 'Romance', 'Horror', 'Mystery', 'Fantasy', 'Sci-Fi', 'Comedy'] 
    },
    { name: 'length', label: 'Story Length (words)', type: 'number', min: 50, max: 500 },
    { 
      name: 'voice', 
      label: 'Narration Voice', 
      type: 'select', 
      options: [
        { value: 'Aditi', label: 'Aditi (Female, Hindi)' },
        { value: 'Kajal', label: 'Kajal (Female, Hindi)' },
        { value: 'Raveena', label: 'Raveena (Female, Hindi)' },
        { value: 'Joanna', label: 'Joanna (Female, US)' },
        { value: 'Matthew', label: 'Matthew (Male, US)' }
      ] 
    },
    { name: 'rate', label: 'Speech Rate', type: 'select', options: ['slow', 'medium', 'fast'] },
  ];

  const characterFields = [
    { name: 'character_name', label: 'Character Name', placeholder: 'Aria' },
    { name: 'character_traits', label: 'Character Traits', placeholder: 'Brave, witty, a bit reckless' },
    { name: 'character_motivation', label: 'Character Motivation', placeholder: 'To find the lost treasure' },
    { name: 'character_flaw', label: 'Character Flaw', placeholder: 'Too trusting of strangers' },
    { name: 'secondary_character_role', label: 'Secondary Character Role', placeholder: 'Mentor, Friend, Rival' },
    { name: 'secondary_character_details', label: 'Secondary Character Details', placeholder: 'An old wise wizard who guides the hero' },
  ];

  const worldFields = [
    { name: 'atmosphere', label: 'Atmosphere', placeholder: 'Dark and mysterious' },
    { name: 'opening_scene', label: 'Opening Scene', type: 'textarea', placeholder: 'The story begins in a dark forest...' },
    { name: 'key_object', label: 'Key Object', placeholder: 'A magical amulet' },
    { name: 'plot_twist', label: 'Plot Twist', type: 'textarea', placeholder: 'The mentor is actually the villain' },
  ];

  return (
    <div className="story-form">
      <div className="form-sections">
        <div className="form-section compulsory-section">
          <h3>⭐ Required Details</h3>
          <div className="form-grid compact">
            {compulsoryFields.map(field => (
              <FormField key={field.name} field={field} formState={formState} onChange={onChange} />
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>📖 Basic Settings</h3>
          <div className="form-grid compact">
            {basicFields.map(field => (
              <FormField key={field.name} field={field} formState={formState} onChange={onChange} />
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>👤 Characters</h3>
          <div className="form-grid compact">
            {characterFields.map(field => (
              <FormField key={field.name} field={field} formState={formState} onChange={onChange} />
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3>🌍 Story World</h3>
          <div className="form-grid compact">
            {worldFields.map(field => (
              <FormField key={field.name} field={field} formState={formState} onChange={onChange} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const FormField = ({ field, formState, onChange }) => (
  <div className="form-group">
    <label htmlFor={field.name}>
      {field.label}
      {field.required && <span className="required">*</span>}
    </label>
    {field.type === 'select' ? (
      <select 
        name={field.name} 
        id={field.name} 
        value={formState[field.name]} 
        onChange={onChange}
        required={field.required}
      >
        {field.options.map(opt => 
          typeof opt === 'object' ? (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ) : (
            <option key={opt} value={opt.toLowerCase()}>{opt}</option>
          )
        )}
      </select>
    ) : field.type === 'textarea' ? (
      <textarea 
        name={field.name} 
        id={field.name} 
        value={formState[field.name]} 
        onChange={onChange} 
        required={field.required} 
        placeholder={field.placeholder} 
        rows="3"
      />
    ) : (
      <input 
        type={field.type || 'text'} 
        name={field.name} 
        id={field.name} 
        value={formState[field.name]} 
        onChange={onChange} 
        required={field.required} 
        placeholder={field.placeholder} 
        min={field.min} 
        max={field.max} 
      />
    )}
  </div>
);

const StoryDisplay = ({ story, isLoading, audioRef, isPlaying, currentWordIndex, audioProgress, audioDuration, onPlayPause, onAudioEnded, onAudioLoadedMetadata, onProgressBarClick }) => {
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="story-display-placeholder">
        <Icons.LoadingSpinner />
        <h2>Crafting your masterpiece...</h2>
        <p>Our AI is dreaming up characters and worlds just for you.</p>
        <div className="loading-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!story) {
    return (
      <div className="story-display-placeholder">
        <div className="welcome-content">
          <h2>{Icons.Create} Welcome to the AI Storyteller</h2>
          <p>Create immersive stories with dramatic audio narration and background music!</p>
          <div className="features-grid">
            <div className="feature">
              <span className="feature-icon">🎭</span>
              <h3>Character Development</h3>
              <p>Create complex characters with motivations and flaws</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🌍</span>
              <h3>Rich World Building</h3>
              <p>Set the atmosphere and create immersive settings</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🎵</span>
              <h3>Dynamic Audio</h3>
              <p>Dramatic narration with genre-specific background music</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderHighlightedText = () => {
    if (!story.text) return null;
    
    const words = story.text.split(/\s+/);
    return words.map((word, index) => {
      const shouldHighlight = index <= currentWordIndex && isPlaying && currentWordIndex >= 0;
      
      return (
        <span 
          key={index} 
          className={shouldHighlight ? 'highlighted-text' : ''}
        >
          {word}{index < words.length - 1 ? ' ' : ''}
        </span>
      );
    });
  };

  return (
    <article className="story-display">
      {/* Modified Compact Story Header */}
      <div className="story-header compact">
        <div className="story-title-row">
          <h2>{story.title}</h2>
          <div className="story-meta-inline">
            <span className="genre-badge">{story.genre}</span>
            <span className="word-count">~{story.length}w</span>
            <span className="voice-info">🗣️ {story.voice}</span>
          </div>
        </div>
      </div>

      {/* Compact Audio Player */}
      {story.audio_url && (
        <div className="audio-player-container compact">
          <audio 
            ref={audioRef}
            src={story.audio_url}
            onEnded={onAudioEnded}
            onLoadedMetadata={onAudioLoadedMetadata}
            preload="metadata"
          />
          
          <div className="custom-audio-player compact">
            <button 
              onClick={onPlayPause} 
              className="play-pause-btn compact"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? Icons.Pause : Icons.Play}
            </button>
            
            <div className="audio-progress-container">
              <div className="audio-time-info">
                <span className="current-time">
                  {formatTime((audioProgress / 100) * audioDuration)}
                </span>
                <span className="total-time">
                  {formatTime(audioDuration)}
                </span>
              </div>
              <div 
                className="audio-progress-bar clickable" 
                onClick={onProgressBarClick}
                role="slider"
                aria-label="Audio progress"
              >
                <div 
                  className="audio-progress-fill" 
                  style={{ width: `${audioProgress}%` }}
                ></div>
              </div>
              <span className="progress-text">
                {isPlaying ? 'Playing...' : 'Ready to play'}
              </span>
            </div>
            
            <a 
              href={story.audio_url} 
              download={`${story.title}.mp3`}
              className="download-btn compact"
              aria-label="Download audio"
            >
              {Icons.Download}
            </a>
          </div>
        </div>
      )}

      {/* Scrollable Story Content */}
      <div className="story-content scrollable">
        <div className="story-text">
          {renderHighlightedText()}
        </div>
      </div>
    </article>
  );
};

const HistoryView = ({ history, isLoading, onView, onDelete, onCreateNew }) => {
  if (isLoading) {
    return (
      <div className="centered-feedback">
        <Icons.LoadingSpinner /> 
        <h2>Loading History...</h2>
      </div>
    );
  }
  
  if (!history || history.length === 0) {
    return (
      <div className="centered-feedback">
        <div className="empty-state">
          <h2>📚 No stories yet!</h2>
          <p>Your created stories will appear here. Start your storytelling journey!</p>
          <button onClick={onCreateNew} className="btn-primary">
            {Icons.Create} Create Your First Story
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>📚 Your Story Collection</h2>
        <p>{history.length} stories created</p>
      </div>
      
      <div className="history-grid">
        {history.map(item => (
          <div key={item.id} className="history-card">
            <div className="history-card-header">
              <h3>{item.title}</h3>
              <span className="genre-badge small">{item.genre}</span>
            </div>
            
            <p className="history-preview">
              {item.text ? item.text.substring(0, 120) + '...' : 'No preview available'}
            </p>
            
            <div className="history-meta">
              <span>🗣️ {item.voice}</span>
              <span>⏱️ {item.rate}</span>
              <span>📝 ~{item.length}w</span>
            </div>
            
            <div className="history-actions">
              <button onClick={() => onView(item)} className="btn-primary">
                View & Edit
              </button>
              <button 
                onClick={() => onDelete(item.id, item.title)} 
                className="btn-delete"
                title="Delete this story permanently"
              >
                {Icons.Delete} Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Toast Notification Component
const Toast = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-content">
        <span className="toast-icon">
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
        </span>
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

export default StorytellerApp;
