import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Phones only open the camera on https, so the dev server uses a self-signed certificate.
// `HTTP=1 npm run dev` serves plain http (enough for the camera on localhost).
const https = process.env.HTTP !== '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl({ name: 'paseo-club' })] : [])],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
