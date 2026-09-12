import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LessonDemo } from './LessonDemo';
import './styles.css';
import './performance.css';
import './session-log.css';

const lessonDemo = new URLSearchParams(window.location.search).get('lesson') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {lessonDemo ? <LessonDemo /> : <App />}
  </StrictMode>,
);
