import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LessonDemo } from './LessonDemo';
import './styles.css';
import './performance.css';
import './session-log.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LessonDemo />
  </StrictMode>,
);
