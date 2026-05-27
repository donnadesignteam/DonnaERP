import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Donna Admin',
    short_name: 'Donna',
    description: 'Donna Design Management System',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#1E1208',
    theme_color: '#C47E3A',
    icons: [
      {
        src: '/donna-logo.jpg',
        sizes: 'any',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/donna-logo.jpg',
        sizes: 'any',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  }
}
