import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LessonDemo } from './LessonDemo';
import './styles.css';
import './performance.css';
import './session-log.css';
import './lesson-diagnostics.css';

const lessonDemo = new URLSearchParams(window.location.search).get('lesson') === '1';
const root = createRoot(document.getElementById('root')!);

if (lessonDemo) {
  root.render(<LessonDemo />);
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
