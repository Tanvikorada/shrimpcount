import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VITE_BASE lets the same app be served from a sub-path, e.g. /app/ under the website.
export default defineConfig({ base: process.env.VITE_BASE || '/', plugins: [react(), tailwindcss()] })
