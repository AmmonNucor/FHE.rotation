'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [existingCode, setExistingCode] = useState('')
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

  async function handleExistingHousehold(e: React.FormEvent) {
    e.preventDefault()
    if (!existingCode.trim()) return

    router.push(`/h/${existingCode.trim()}`)
  }

  return (
    <main style={{ maxWidth: 500, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Family Home Evening</h1>

      <details open>
        <summary>Create New Household</summary>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Household name (e.g. Smith Family)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Household code (e.g. smith-family)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p style={{ fontSize: '0.85em', color: '#666' }}>
            You'll use this code to return to your household. Choose something memorable
            but not easily guessed by strangers.
          </p>
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating...' : 'Create Household'}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
      </details>

      <details>
        <summary>Join Existing Household</summary>
        <form onSubmit={handleExistingHousehold}>
          <input
            type="text"
            placeholder="Enter household code"
            value={existingCode}
            onChange={(e) => setExistingCode(e.target.value)}
          />
          <button type="submit" style={{ width: '100%' }}>
            Go to Household
          </button>
        </form>
      </details>
    </main>
  )
}