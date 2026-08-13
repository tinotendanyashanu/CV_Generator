export const THEMES = {
  ats: {
    page: '#ffffff', header: '#ffffff', body: '#ffffff',
    name: '#111111', title: '#333333', text: '#111111', muted: '#444444',
    accent: '#111111', contact: '#333333'
  },
  classic: {
    page: '#ffffff', header: '#ffffff', body: '#ffffff',
    name: '#1f2937', title: '#4b5563', text: '#1a1d23', muted: '#4b5563',
    accent: '#1f2937', contact: '#4b5563'
  },
  monochrome: {
    page: '#ffffff', header: '#ffffff', body: '#ffffff',
    name: '#000000', title: '#222222', text: '#111111', muted: '#333333',
    accent: '#000000', contact: '#333333'
  },
  modular: {
    page: '#ffffff', header: '#3a506b', body: '#ffffff',
    name: '#ffffff', title: '#dbe4ee', text: '#1a1d23', muted: '#5c6b73',
    accent: '#3a506b', contact: '#e8eef3'
  },
  minimal: {
    page: '#ffffff', header: '#ffffff', body: '#ffffff',
    name: '#111111', title: '#6b7280', text: '#1a1d23', muted: '#6b7280',
    accent: '#6b7280', contact: '#6b7280'
  },
  corporate: {
    page: '#ffffff', header: '#ffffff', body: '#ffffff',
    name: '#134e4a', title: '#0f766e', text: '#1a1d23', muted: '#4b5563',
    accent: '#0f766e', contact: '#4b5563'
  },
  modern: {
    page: '#ffffff', header: '#1d4ed8', body: '#ffffff',
    name: '#ffffff', title: '#dbeafe', text: '#1a1d23', muted: '#4b5563',
    accent: '#2563eb', contact: '#eff6ff'
  },
  tech: {
    page: '#0b1220', header: '#0f172a', body: '#f8fafc',
    name: '#ffffff', title: '#93c5fd', text: '#0f172a', muted: '#334155',
    accent: '#0969da', contact: '#e0f2fe', headerTextOnDark: true
  },
  silver: {
    page: '#eceff3', header: '#d1d5db', body: '#ffffff',
    name: '#111827', title: '#4b5563', text: '#1a1d23', muted: '#4b5563',
    accent: '#6b7280', contact: '#374151'
  },
  'product-lead': {
    page: '#0b1220', header: '#111827', body: '#111827',
    name: '#ffffff', title: '#93c5fd', text: '#e2e8f0', muted: '#cbd5e1',
    accent: '#93c5fd', contact: '#cbd5e1'
  },
  'gradient-wave': {
    page: '#eef2ff', header: '#667eea', body: '#ffffff',
    name: '#ffffff', title: '#f5f3ff', text: '#1e293b', muted: '#5b21b6',
    accent: '#5b21b6', contact: '#ffffff'
  },
  executive: {
    page: '#f4f6fb', header: '#0b1f44', body: '#ffffff',
    name: '#ffffff', title: '#dbe4f5', text: '#1a1d23', muted: '#4b5563',
    accent: '#0b1f44', contact: '#dbe4f5'
  },
  creative: {
    page: '#f5f3ff', header: '#4c1d95', body: '#ffffff',
    name: '#ffffff', title: '#ddd6fe', text: '#1a1d23', muted: '#6d28d9',
    accent: '#6d28d9', contact: '#ffffff'
  },
  academic: {
    page: '#ffffff', header: '#2d3748', body: '#ffffff',
    name: '#edf2f7', title: '#cbd5e1', text: '#1a1d23', muted: '#4a5568',
    accent: '#4a5568', contact: '#edf2f7', sidebar: true, side: '#2d3748'
  },
  sidebar: {
    page: '#ffffff', header: '#0f172a', body: '#ffffff',
    name: '#e2e8f0', title: '#cbd5e1', text: '#1a1d23', muted: '#64748b',
    accent: '#0f172a', contact: '#e2e8f0', sidebar: true, side: '#0f172a'
  },
  'neon-tech': {
    page: '#070b08', header: '#10182a', body: '#0a1810',
    name: '#00ff41', title: '#00d4ff', text: '#bbf7d0', muted: '#86efac',
    accent: '#00ff41', contact: '#ff9f43'
  },
  'luxury-gold': {
    page: '#f6ecd7', header: '#d4af37', body: '#fffdf7',
    name: '#2c1810', title: '#3f2d14', text: '#2c1810', muted: '#7c5a1e',
    accent: '#b8860b', contact: '#3f2d14'
  },
  'watermark-pro': {
    page: '#f7fafc', header: '#e2e8f0', body: '#ffffff',
    name: '#2d3748', title: '#4a5568', text: '#2d3748', muted: '#718096',
    accent: '#4299e1', contact: '#4a5568'
  },
  'minimal-glass': {
    page: '#5b4bdb', header: '#6d5ce7', body: '#ffffff',
    name: '#ffffff', title: '#f5f3ff', text: '#1a202c', muted: '#4a5568',
    accent: '#667eea', contact: '#ffffff'
  },
  'bold-geometric': {
    page: '#f7fafc', header: '#111111', body: '#ffffff',
    name: '#ffffff', title: '#facc15', text: '#2d3748', muted: '#4a5568',
    accent: '#dc2626', contact: '#ffffff'
  },
  'artistic-portfolio': {
    page: '#fff7fb', header: '#fff7fb', body: '#ffffff',
    name: '#831843', title: '#be185d', text: '#1a1d23', muted: '#9d174d',
    accent: '#db2777', contact: '#831843'
  }
};

export function themeFor(template, ats = false) {
  if (ats) return THEMES.ats;
  return THEMES[template] || THEMES.ats;
}

export function paperColor(template) {
  return (THEMES[template] || THEMES.ats).page;
}
