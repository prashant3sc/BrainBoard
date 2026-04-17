import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode is intentionally omitted: @hello-pangea/dnd double-invokes
// effects in StrictMode which corrupts its internal drag state.
createRoot(document.getElementById('root')!).render(<App />)
