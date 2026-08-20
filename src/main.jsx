import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CloudCandyTown from './CloudCandyTown.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CloudCandyTown />
  </StrictMode>,
)
