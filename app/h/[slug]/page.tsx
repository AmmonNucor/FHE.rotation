'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Member = { id: string; name: string; age: number }
type Task = { id: string; name: string; sort_order: number; is_selected: boolean }
type Rotation = { task_id: string; current_member_id: string }

export default function HouseholdPage() {
  const params = useParams()
  const slug = params.slug as string

  const [householdName, setHouseholdName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberAge, setNewMemberAge] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set())

  const loadHousehold = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_household', { p_slug: slug })
    setLoading(false)

    if (error || !data) {
      setError('Household not found')
      return
    }

    setHouseholdName(data.household.name)
    setMembers((data.members || []).sort((a: Member, b: Member) => a.age - b.age))
    const loadedTasks = (data.tasks || []).sort((a: Task, b: Task) => a.sort_order - b.sort_order)
    setTasks(loadedTasks)
    setRotations(data.rotation || [])
    setCheckedTaskIds(new Set(loadedTasks.filter((t: Task) => t.is_selected).map((t: Task) => t.id)))
  }, [slug])

  useEffect(() => {
    loadHousehold()
  }, [loadHousehold])

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim() || !newMemberAge) return

    const { error } = await supabase.rpc('add_member', {
      p_slug: slug,
      member_name: newMemberName.trim(),
      member_age: parseInt(newMemberAge, 10),
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewMemberName('')
    setNewMemberAge('')
    loadHousehold()
  }

  async function handleRemoveMember(id: string) {
    const { error } = await supabase.rpc('remove_member', { p_slug: slug, p_member_id: id })
    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTaskName.trim()) return

    const { error } = await supabase.rpc('add_task', {
      p_slug: slug,
      task_name: newTaskName.trim(),
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewTaskName('')
    loadHousehold()
  }

  async function handleRemoveTask(id: string) {
    const { error } = await supabase.rpc('remove_task', { p_slug: slug, p_task_id: id })
    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  async function handleRenameHousehold(e: React.FormEvent) {
    e.preventDefault()
    if (!newCode.trim()) return

    const { data, error } = await supabase.rpc('rename_household', {
      p_slug: slug,
      new_code: newCode.trim(),
    })

    if (error) {
      setError(error.message)
      return
    }

    router.push(`/h/${data}`)
  }


  function toggleTaskChecked(id: string) {
    const next = new Set(checkedTaskIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setCheckedTaskIds(next)
  }

  async function handleSetRotation() {
    if (checkedTaskIds.size !== members.length) {
      setError(`Select exactly ${members.length} task(s) to match your ${members.length} member(s).`)
      return
    }
    setError('')

    const { error: selectError } = await supabase.rpc('select_tasks', {
      p_slug: slug,
      p_task_ids: Array.from(checkedTaskIds),
    })
    if (selectError) {
      setError(selectError.message)
      return
    }

    const { error: assignError } = await supabase.rpc('auto_assign', { p_slug: slug })
    if (assignError) {
      setError(assignError.message)
      return
    }

    loadHousehold()
  }

  async function handleRotate() {
    const { error } = await supabase.rpc('rotate_all', { p_slug: slug })
    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  function getMemberName(id: string | undefined) {
    if (!id) return 'Unassigned'
    const member = members.find((m) => m.id === id)
    return member ? member.name : 'Unassigned'
  }

  const selectedTasks = tasks.filter((t) => t.is_selected).sort((a, b) => a.sort_order - b.sort_order)
  const hasActiveRotation = selectedTasks.length > 0 && selectedTasks.length === members.length
  const [newCode, setNewCode] = useState('')
  const router = useRouter()


  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{householdName}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Primary view: current assignments, shown first once active */}
      {hasActiveRotation && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>Current Assignments</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {selectedTasks.map((t) => {
              const rotation = rotations.find((r) => r.task_id === t.id)
              return (
                <li key={t.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <strong>{t.name}</strong>: {getMemberName(rotation?.current_member_id)}
                </li>
              )
            })}
          </ul>
          <button onClick={handleRotate} style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem' }}>
            Rotate
          </button>
        </section>
      )}

      {/* Setup / management, collapsed once a rotation is active */}
      <details open={!hasActiveRotation} style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold' }}>
          {hasActiveRotation ? 'Manage Members & Tasks' : 'Set Up Rotation'}
        </summary>

        <section style={{ marginTop: '1rem' }}>
          <h3>Members</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {members.map((m) => (
              <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                <span>{m.name} (age {m.age})</span>
                <button onClick={() => handleRemoveMember(m.id)}>Remove</button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="text"
              placeholder="Name"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              style={{ flex: 2, padding: '0.5rem' }}
            />
            <input
              type="number"
              placeholder="Age"
              value={newMemberAge}
              onChange={(e) => setNewMemberAge(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit">Add</button>
          </form>
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <h3>Tasks</h3>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            Select {members.length} task{members.length === 1 ? '' : 's'} for the current rotation.
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={checkedTaskIds.has(t.id)}
                    onChange={() => toggleTaskChecked(t.id)}
                  />
                  {t.name}
                </label>
                <button onClick={() => handleRemoveTask(t.id)}>Remove</button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="text"
              placeholder="Task name"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit">Add</button>
          </form>
          <button
            onClick={handleSetRotation}
            disabled={members.length === 0}
            style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem' }}
          >
            Set Rotation ({checkedTaskIds.size}/{members.length} selected)
          </button>
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <h3>Household Code</h3>
          <p style={{ fontSize: '0.9em', color: '#666' }}>Current code: {slug}</p>
          <form onSubmit={handleRenameHousehold} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="New household code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit">Update</button>
          </form>
        </section>

      </details>
    </main>
  )
}
