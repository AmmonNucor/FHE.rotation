'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return

    setLoading(true)
    setError('')

    const { data, error } = await supabase.rpc('create_household', {
      household_name: name.trim(),
      desired_code: code.trim(),
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push(`/h/${data}`)
  }

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Household Rotation</h1>
      <p>Create a new household to get started.</p>
      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Household name (e.g. Smith Family)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
        />
        <input
          type="text"
          placeholder="Household code (e.g. smith-family)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
        />
        <p style={{ fontSize: '0.85em', color: '#666', marginTop: '-0.25rem' }}>
          You&apos;ll use this code to return to your household. Choose something memorable
          but not easily guessed by strangers.
        </p>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem' }}>
          {loading ? 'Creating...' : 'Create Household'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </main>
  )
}