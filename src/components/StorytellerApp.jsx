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
  story_theme: '',
  genre: 'select',
  length: 300,
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

  // UI state
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState('story'); // 'story' or 'settings'

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

  // Profile modal state
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [userEmail, setUserEmail] = useState('');

useEffect(() => {
  if (user && typeof user.getUserAttributes === 'function') {
    user.getUserAttributes((err, attributes) => {
      if (!err && attributes) {
        const emailAttr = attributes.find(attr => attr.Name === 'email');
        if (emailAttr) setUserEmail(emailAttr.Value);
      }
    });
  }
}, [user]);

  // Refs
  const audioRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Effects
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('storyteller-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const showFormOnMobile = useMemo(() => {
    if (!isMobile || view !== 'create') return false;
    if (!currentStory) {
      return true;
    }
    return mobileView === 'settings';
  }, [isMobile, view, currentStory, mobileView]);

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
    setTimeout(() => setToast(null), 3000);
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
        const headers = { 'Authorization': token, ...options.headers };
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
            if (response.status === 204 || response.headers.get('content-length') === '0') return {};
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
    if (view === 'history') fetchHistory();
  }, [view, fetchHistory]);

  // --- EVENT HANDLERS ---
  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    if (name === 'length') {
      let num = parseInt(value, 10);
      if (isNaN(num)) num = '';
      if (num !== '') {
        if (num < 100) num = 100;
        if (num > 800) num = 800;
      }
      setFormState(prev => ({ ...prev, [name]: num }));
    } else {
      setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value, 10) : value }));
    }
  };

  const handleCreateNew = () => {
    setCurrentStory(null);
    setFormState(INITIAL_FORM_STATE);
    setError('');
    setIsNavOpen(false);
    stopAudioTracking();
    setMobileView('story');
    setView('create');
  };

  const handleViewFromHistory = (historyItem) => {
    setCurrentStory(historyItem);
    setFormState({
      story_name: historyItem.title, story_theme: historyItem.story_theme, genre: historyItem.genre,
      length: historyItem.length, voice: historyItem.voice, rate: historyItem.rate,
      character_name: historyItem.character_name || '', character_traits: historyItem.character_traits || '',
      character_motivation: historyItem.character_motivation || '', character_flaw: historyItem.character_flaw || '',
      secondary_character_role: historyItem.secondary_character_role || '', secondary_character_details: historyItem.secondary_character_details || '',
      atmosphere: historyItem.atmosphere || '', opening_scene: historyItem.opening_scene || '',
      key_object: historyItem.key_object || '', plot_twist: historyItem.plot_twist || '',
    });
    setView('create');
    setError('');
    setIsNavOpen(false);
    stopAudioTracking();
    setMobileView('story');
  };

  const handleGenerateStory = async (e) => {
    e.preventDefault();
    if (!formState.genre || formState.genre === 'select') {
      setError('Please select a genre.');
      return;
    }
    setIsLoading(true);
    setError('');
    stopAudioTracking();

    const filteredFormState = Object.fromEntries(
      Object.entries(formState).filter(([key, value]) => value !== '')
    );

    try {
      const data = await authenticatedFetch('/story', {
        method: 'POST',
        body: JSON.stringify(filteredFormState)
      });
      const newStoryObject = {
        ...formState,
        title: formState.story_name,
        text: data.story,
        audio_url: data.audio_url,
        id: data.audio_url.split('/').pop().split('?')[0].replace('.mp3', '')
      };
      setCurrentStory(newStoryObject);
      fetchHistory();
      setMobileView('story');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateAudio = async () => {
    if (!currentStory) return;
    setIsAudioLoading(true);
    setError('');
    stopAudioTracking();
    try {
      const data = await authenticatedFetch('/regenerate-audio', { method: 'POST', body: JSON.stringify({ story_id: currentStory.id, voice: formState.voice, rate: formState.rate }) });
      setCurrentStory(prev => ({ ...prev, audio_url: data.audio_url, voice: formState.voice, rate: formState.rate }));
      fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const handleDeleteStory = async (storyId, storyTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${storyTitle}"?\n\nThis action cannot be undone.`)) return;
    try {
      setError('');
      await authenticatedFetch(`/story/${storyId}`, { method: 'DELETE' });
      setHistory(prev => prev.filter(story => story.id !== storyId));
      if (currentStory?.id === storyId) handleCreateNew();
      showToast(`Story "${storyTitle}" deleted.`, 'success');
    } catch (err) {
      setError(`Failed to delete story: ${err.message}`);
      fetchHistory();
    }
  };

  // Audio handlers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      setIsPlaying(true);
      startAudioTracking();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopAudioTracking();
    };
    const onEnded = () => {
      setIsPlaying(false);
      stopAudioTracking();
    };
    const onLoadedMetadata = () => {
      if (audioRef.current) setAudioDuration(audioRef.current.duration);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [startAudioTracking, stopAudioTracking]);

  const handleProgressBarClick = (e) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    audioRef.current.currentTime = clickPercent * audioDuration;
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // ========================= PROFILE MODAL =========================
  // Add Profile button in header, remove Logout from header, and show Logout inside profile modal
  // Only show user's email (user?.username)
  // =================================================================
  return (
    <div className="storyteller-app">
      <NavSidebar
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        onLogout={onLogout}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        view={view}
        onNavigate={(newView) => {
          if (newView === 'create') handleCreateNew();
          else setView(newView);
          setIsNavOpen(false);
        }}
         onProfile={() => setIsProfileOpen(true)} // <-- add this line
      />
      {isNavOpen && <div className="overlay" onClick={() => setIsNavOpen(false)} />}

      <Header
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        view={view}
        onNavigate={(newView) => {
          if (newView === 'create') handleCreateNew();
          else setView(newView);
        }}
        onToggleNav={() => setIsNavOpen(true)}
        onProfile={() => setIsProfileOpen(true)}
      />

      {isProfileOpen && (
  <div className="profile-modal-overlay" onClick={() => setIsProfileOpen(false)}>
    <div
      className="profile-modal"
      onClick={e => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <h3>Your Profile</h3>
      <div className="profile-info-row">
        <span className="profile-label">Email:</span>
        <span className="profile-value">{userEmail || 'Unknown'}</span>
      </div>
      <button
        className="profile-logout-btn"
        onClick={() => {
          setIsProfileOpen(false);
          onLogout();
        }}
        aria-label="Logout"
      >
        <span role="img" aria-label="Logout">🚪</span> Logout
      </button>
      <button
        className="profile-close-btn"
        onClick={() => setIsProfileOpen(false)}
        aria-label="Close"
      >
        Close
      </button>
    </div>
  </div>
)}


      <main className="app-main">
        <aside className="desktop-sidebar">
          <StoryForm
            formState={formState} currentStory={currentStory}
            isLoading={isLoading} isAudioLoading={isAudioLoading}
            hasContentChanged={hasContentChanged} onChange={handleFormChange}
            onSubmit={handleGenerateStory} onRegenerateAudio={handleRegenerateAudio}
            onCreateNew={handleCreateNew}
          />
        </aside>

        <div className="content-area">
          {error && <div className="error-banner">{error}</div>}

          {isMobile && currentStory && view === 'create' && (
            <MobileViewToggle
              mobileView={mobileView}
              onToggle={setMobileView}
            />
          )}

          {showFormOnMobile && (
            <div className="mobile-form-container">
              <StoryForm
                formState={formState} currentStory={currentStory}
                isLoading={isLoading} isAudioLoading={isAudioLoading}
                hasContentChanged={hasContentChanged} onChange={handleFormChange}
                onSubmit={handleGenerateStory} onRegenerateAudio={handleRegenerateAudio}
                onCreateNew={handleCreateNew}
              />
            </div>
          )}

          <div className={`story-display-container ${showFormOnMobile ? 'hidden-on-mobile' : ''}`}>
            {view === 'create' ? (
              <StoryDisplay
                story={currentStory} isLoading={isLoading} audioRef={audioRef}
                isPlaying={isPlaying} currentWordIndex={currentWordIndex}
                audioProgress={audioProgress} audioDuration={audioDuration}
                onPlayPause={handlePlayPause}
                onProgressBarClick={handleProgressBarClick}
              />
            ) : (
              <HistoryView
                history={history} isLoading={isHistoryLoading} onView={handleViewFromHistory}
                onDelete={handleDeleteStory} onCreateNew={handleCreateNew}
              />
            )}
          </div>
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mobile-bottom-buffer"></div>
    </div>
  );
}

// =================================================================================================
// Sub-Components
// =================================================================================================

const MobileViewToggle = ({ mobileView, onToggle }) => (
  <div className="mobile-view-toggle-bar">
    {mobileView === 'story' ? (
      <button onClick={() => onToggle('settings')} className="btn-secondary">
        View Story Settings
      </button>
    ) : (
      <button onClick={() => onToggle('story')} className="btn-secondary">
        View Generated Story
      </button>
    )}
  </div>
);

const Header = ({ isDarkMode, onToggleTheme, view, onNavigate, onToggleNav, onProfile }) => (
  <header className="app-header">
    <div className="header-content">
      <h1>AI Storyteller</h1>
      <div className="header-actions">
        <button onClick={() => onNavigate('create')} className={`header-btn ${view === 'create' ? 'active' : ''}`}>
          Create
        </button>
        <button onClick={() => onNavigate('history')} className={`header-btn ${view === 'history' ? 'active' : ''}`}>
          History
        </button>
        <button onClick={onToggleTheme} className="header-btn theme-toggle-btn" title="Toggle theme">
          {isDarkMode ? Icons.Sun : Icons.Moon}
          <span className="visually-hidden">Theme</span>
        </button>
        <button onClick={onProfile} className="header-btn" aria-label="Profile">
        Profile
        </button>
      </div>
      <button onClick={onToggleNav} className="mobile-nav-toggle-btn" aria-label="Open navigation">
        {Icons.Menu}
      </button>
    </div>
  </header>
);

const NavSidebar = ({ isOpen, onClose, onLogout, isDarkMode, onToggleTheme, view, onNavigate, onProfile }) => (
  <aside className={`nav-sidebar ${isOpen ? 'open' : ''}`}>
    <div className="nav-sidebar-header">
      <h3>Navigation</h3>
      <button onClick={onClose} className="close-btn">{Icons.Close}</button>
    </div>
    <div className="nav-group">
      <button onClick={() => onNavigate('create')} className={`header-btn nav-btn ${view === 'create' ? 'active' : ''}`}>
        Create
      </button>
      <button onClick={() => onNavigate('history')} className={`header-btn nav-btn ${view === 'history' ? 'active' : ''}`}>
        History
      </button>
      <button onClick={onToggleTheme} className="header-btn nav-btn" aria-label="Toggle theme">
        Theme
      </button>
      <button onClick={onProfile} className="header-btn" aria-label="Profile">
        Profile
      </button>
    </div>
  </aside>
);

const SidebarActions = ({ currentStory, isLoading, isAudioLoading, hasContentChanged, onSubmit, onRegenerateAudio, onCreateNew }) => (
  <div className="sidebar-actions">
    {currentStory && (
      <button onClick={onCreateNew} className="btn-secondary new-story-btn">
        {Icons.NewStory} New Story
      </button>
    )}
    {!currentStory ? (
      <button onClick={onSubmit} disabled={isLoading} className="btn-primary">
        {isLoading ? <><Icons.LoadingSpinner /> Creating...</> : 'Create Story'}
      </button>
    ) : hasContentChanged ? (
      <button onClick={onSubmit} disabled={isLoading} className="btn-primary">
        {isLoading ? <><Icons.LoadingSpinner /> Regenerating...</> : 'Regenerate Story'}
      </button>
    ) : (
      <button onClick={onRegenerateAudio} disabled={isAudioLoading} className="btn-secondary">
        {isAudioLoading ? <><Icons.LoadingSpinner /> Updating Audio...</> : 'Update Audio Only'}
      </button>
    )}
  </div>
);

const StoryForm = (props) => {
  const compulsoryFields = [
    { name: 'story_name', label: 'Story Name', placeholder: 'The Lost City of Zym', required: true },
    { name: 'story_theme', label: 'Story Theme/Plot', type: 'textarea', required: true, placeholder: 'An explorer seeks a rare flower...' },
    { name: 'genre', label: 'Genre', type: 'select', required: true, options: [
      { value: 'select', label: 'Select genre' },
      { value: 'Adventure', label: 'Adventure' },
      { value: 'Romance', label: 'Romance' },
      { value: 'Horror', label: 'Horror' },
      { value: 'Mystery', label: 'Mystery' },
      { value: 'Fantasy', label: 'Fantasy' },
      { value: 'Sci-Fi', label: 'Sci-Fi' },
      { value: 'Comedy', label: 'Comedy' }
    ] },
  ];
  const basicFields = [
    { name: 'length', label: 'Story Length (words)', type: 'range', min: 100, max: 800, step: 10 },
    { name: 'voice', label: 'Narration Voice', type: 'select', options: [ { value: 'Aditi', label: 'Aditi (Female, Hindi)' }, { value: 'Kajal', label: 'Kajal (Female, Hindi)' }, { value: 'Joanna', label: 'Joanna (Female, US)' }, { value: 'Matthew', label: 'Matthew (Male, US)' } ] },
    { name: 'rate', label: 'Speech Rate', type: 'select', options: ['slow', 'medium', 'fast'] },
  ];
  const characterFields = [
    { name: 'character_name', label: 'Character Name', placeholder: 'Aria' },
    { name: 'character_traits', label: 'Character Traits', placeholder: 'Brave, witty, a bit reckless' },
    { name: 'character_motivation', label: 'Character Motivation', placeholder: 'To find the lost treasure' },
    { name: 'character_flaw', label: 'Character Flaw', placeholder: 'Too trusting of strangers' },
    { name: 'secondary_character_role', label: 'Secondary Character Role', placeholder: 'Mentor, Friend, Rival' },
    { name: 'secondary_character_details', label: 'Secondary Character Details', placeholder: 'An old wise wizard...' },
  ];
  const worldFields = [
    { name: 'atmosphere', label: 'Atmosphere', placeholder: 'Dark and mysterious' },
    { name: 'opening_scene', label: 'Opening Scene', type: 'textarea', placeholder: 'The story begins in a dark forest...' },
    { name: 'key_object', label: 'Key Object', placeholder: 'A magical amulet' },
    { name: 'plot_twist', label: 'Plot Twist', type: 'textarea', placeholder: 'The mentor is actually the villain' },
  ];

  return (
    <>
      <SidebarActions {...props} />
      <div className="story-form">
        <div className="form-sections">
          <div className="form-section">
            <h3>Required Details</h3>
            <div className="form-grid compact">
              {compulsoryFields.map(field => <FormField key={field.name} field={field} formState={props.formState} onChange={props.onChange} />)}
            </div>
          </div>
          <div className="form-section">
            <h3>Basic Settings</h3>
            <div className="form-grid compact">
              {basicFields.map(field => <FormField key={field.name} field={field} formState={props.formState} onChange={props.onChange} />)}
            </div>
          </div>
          <div className="form-section">
            <h3>Characters</h3>
            <div className="form-grid compact">
              {characterFields.map(field => <FormField key={field.name} field={field} formState={props.formState} onChange={props.onChange} />)}
            </div>
          </div>
          <div className="form-section">
            <h3>Story World</h3>
            <div className="form-grid compact">
              {worldFields.map(field => <FormField key={field.name} field={field} formState={props.formState} onChange={props.onChange} />)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const FormField = ({ field, formState, onChange }) => (
  <div className="form-group">
    <label htmlFor={field.name}>
      {field.label}
      {field.required && <span className="required">*</span>}
    </label>
    {field.name === 'length' ? (
      <div className="range-slider-wrapper">
        <input
          type="range"
          name={field.name}
          id={field.name}
          min={field.min}
          max={field.max}
          step={field.step || 10}
          value={formState[field.name]}
          onChange={onChange}
          className="length-slider"
        />
        <div className="slider-labels">
          <span>{field.min}</span>
          <span>{formState[field.name]} words</span>
          <span>{field.max}</span>
        </div>
      </div>
    ) : field.type === 'select' ? (
      <select
        name={field.name}
        id={field.name}
        value={formState[field.name]}
        onChange={onChange}
        required={field.required}
      >
        {field.options.map(opt =>
          typeof opt === 'object'
            ? <option key={opt.value} value={opt.value} disabled={opt.value === 'select'}>{opt.label}</option>
            : <option key={opt} value={opt.toLowerCase()}>{opt}</option>
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

const StoryDisplay = ({ story, isLoading, audioRef, isPlaying, currentWordIndex, audioProgress, audioDuration, onPlayPause, onProgressBarClick }) => {
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="centered-feedback">
        <Icons.LoadingSpinner />
        <h2>Crafting your masterpiece...</h2>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="story-display-placeholder">
        <div className="welcome-content">
          <h2>{Icons.Create} Welcome to the AI Storyteller</h2>
          <p>Use the settings on the left to begin your adventure.</p>
        </div>
      </div>
    );
  }

  const renderHighlightedText = () => {
    if (!story.text) return null;
    const words = story.text.split(/(\s+)/);
    let wordCount = 0;
    return words.map((word, index) => {
      const isWord = word.trim() !== '';
      if (isWord) {
        const highlight = wordCount <= currentWordIndex && isPlaying;
        wordCount++;
        return <span key={index} className={highlight ? 'highlighted-text' : ''}>{word}</span>;
      }
      return <span key={index}>{word}</span>;
    });
  };

  return (
    <article className="story-display">
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

      {story.audio_url && (
        <div className="audio-player-container compact">
          <audio ref={audioRef} src={story.audio_url} preload="metadata" />
          <div className="custom-audio-player compact">
            <button onClick={onPlayPause} className="play-pause-btn compact" aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? Icons.Pause : Icons.Play}
            </button>
            <div className="audio-progress-container">
              <div className="audio-time-info">
                <span className="current-time">{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span className="total-time">{formatTime(audioDuration)}</span>
              </div>
              <div className="audio-progress-bar clickable" onClick={onProgressBarClick}>
                <div className="audio-progress-fill" style={{ width: `${(audioProgress / 100) * 100}%` }}></div>
              </div>
            </div>
            <a href={story.audio_url} download={`${story.title}.mp3`} className="download-btn compact" aria-label="Download audio">
              {Icons.Download}
            </a>
          </div>
        </div>
      )}

      <div className="story-content scrollable">
        <div className="story-text">{renderHighlightedText()}</div>
      </div>
    </article>
  );
};

const HistoryView = ({ history, isLoading, onView, onDelete, onCreateNew }) => {
  if (isLoading) return <div className="centered-feedback"><Icons.LoadingSpinner /> <h2>Loading History...</h2></div>;
  if (!history || history.length === 0) {
    return (
      <div className="centered-feedback">
        <div className="empty-state">
          <h2>No stories yet!</h2>
          <p>Your created stories will appear here.</p>
          <button onClick={onCreateNew} className="btn-primary">{Icons.Create} Create Your First Story</button>
        </div>
      </div>
    );
  }
  return (
    <div className="history-container">
      <div className="history-header">
        <h2>My Stories</h2>
        <p>{history.length} stories created</p>
      </div>
      <div className="history-grid">
        {history.map(item => (
          <div key={item.id} className="history-card">
            <div className="history-card-header">
              <h3>{item.title}</h3>
              <span className="genre-badge small">{item.genre}</span>
            </div>
            <p className="history-preview">{item.text ? item.text.substring(0, 120) + '...' : 'No preview available'}</p>
            <div className="history-meta">
              <span>🗣️ {item.voice}</span><span>⏱️ {item.rate}</span><span>📝 ~{item.length}w</span>
            </div>
            <div className="history-actions">
              <button onClick={() => onView(item)} className="btn-primary">View & Edit</button>
              <button onClick={() => onDelete(item.id, item.title)} className="btn-delete" title="Delete permanently">
                {Icons.Delete} Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-content">
        <span className="toast-icon">{toast.type === 'success' ? '✅' : '❌'}</span>
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

export default StorytellerApp;
