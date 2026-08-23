'use client'

import Script from 'next/script'

export default function KofiWidget() {
  return (
    <Script
      src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
      onLoad={() => {
        if (typeof (window as any).kofiWidgetOverlay !== 'undefined') {
          (window as any).kofiWidgetOverlay.draw('ammonspiffy3', {
            'type': 'floating-chat',
            'floating-chat.donateButton.text': 'Support Me',
            'floating-chat.donateButton.background-color': '#5cb85c',
            'floating-chat.donateButton.text-color': '#fff'
          });
        }
      }}
    />
  )
}
