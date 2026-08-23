'use client'

import { useEffect } from 'react'

export default function KofiWidget() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js'
    script.onload = () => {
      if (typeof (window as any).kofiWidgetOverlay !== 'undefined') {
        (window as any).kofiWidgetOverlay.draw('ammonspiffy3', {
          'type': 'floating-chat',
          'floating-chat.donateButton.text': 'Support my work',
          'floating-chat.donateButton.background-color': '#5cb85c',
          'floating-chat.donateButton.text-color': '#fff'
        });
      }
    }
    document.head.appendChild(script)
  }, [])

  return null
}
