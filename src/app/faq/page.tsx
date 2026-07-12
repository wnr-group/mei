import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const faq = () => {
  return (
    <div>FAQ&apos;s</div>
  )
}

export default faq