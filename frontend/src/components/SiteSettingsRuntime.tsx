'use client'

import { useEffect } from 'react'

import { useSettings } from '@/hooks/useSettings'

function hexToHsl(hex: string) {
  const value = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return undefined

  const red = parseInt(value.slice(0, 2), 16) / 255
  const green = parseInt(value.slice(2, 4), 16) / 255
  const blue = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  let hue = 0
  let saturation = 0
  const lightness = (max + min) / 2

  if (max !== min) {
    const delta = max - min
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0)
    if (max === green) hue = (blue - red) / delta + 2
    if (max === blue) hue = (red - green) / delta + 4
    hue /= 6
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`
}

export function SiteSettingsRuntime() {
  const settings = useSettings()
  const site = settings.data?.site

  useEffect(() => {
    if (!site) return

    document.title = site.seoTitle || site.siteName

    let description = document.querySelector('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.setAttribute('name', 'description')
      document.head.appendChild(description)
    }
    description.setAttribute('content', site.seoDescription)

    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!favicon) {
      favicon = document.createElement('link')
      favicon.rel = 'icon'
      document.head.appendChild(favicon)
    }
    favicon.href = site.faviconUrl

    const primary = hexToHsl(site.primaryColor)
    const accent = hexToHsl(site.accentColor)
    if (primary) document.documentElement.style.setProperty('--primary', primary)
    if (accent) document.documentElement.style.setProperty('--accent', accent)
  }, [site])

  return null
}
