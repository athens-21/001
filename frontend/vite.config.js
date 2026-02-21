import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: './',  // Use relative paths for assets
    server: {
        port: 5174,
        host: true,
    },
})
