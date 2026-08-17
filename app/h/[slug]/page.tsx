'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Member = {
  id: string
  name: string
  date_of_birth: string
  sort_order: number
  is_active: boolean
  email: string | null
  phone: string | null
}
type Task = { id: string; name: string; sort_order: number; is_selected: boolean }
type Rotation = { task_id: string; current_member_id: string }

function calculateAge(dob: string): number {
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

export default function HouseholdPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [householdName, setHouseholdName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberDob, setNewMemberDob] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set())
  const [showInactive, setShowInactive] = useState(false)
  const [contactDrafts, setContactDrafts] = useState<Record<string, { email: string; phone: string }>>({})
  const [notifyChecked, setNotifyChecked] = useState<Set<string>>(new Set())
  const [newCode, setNewCode] = useState('')

  const loadHousehold = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_household', { p_slug: slug })
    setLoading(false)

    if (error || !data) {
      setError('Household not found')
      return
    }

    setHouseholdName(data.household.name)
    const loadedMembers: Member[] = (data.members || []).sort(
      (a: Member, b: Member) => a.sort_order - b.sort_order
    )
    setMembers(loadedMembers)

    const drafts: Record<string, { email: string; phone: string }> = {}
    loadedMembers.forEach((m) => {
      drafts[m.id] = { email: m.email || '', phone: m.phone || '' }
    })
    setContactDrafts(drafts)

    const loadedTasks = (data.tasks || []).sort((a: Task, b: Task) => a.sort_order - b.sort_order)
    setTasks(loadedTasks)
    setRotations(data.rotation || [])
    setCheckedTaskIds(new Set(loadedTasks.filter((t: Task) => t.is_selected).map((t: Task) => t.id)))
  }, [slug])

  useEffect(() => {
    loadHousehold()
  }, [loadHousehold])

  // --- Members ---

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!newMemberName.trim() || !newMemberDob) return

    const { error } = await supabase.rpc('add_member', {
      p_slug: slug,
      member_name: newMemberName.trim(),
      member_dob: newMemberDob,
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewMemberName('')
    setNewMemberDob('')
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

  async function handleToggleActive(id: string, active: boolean) {
    const { error } = await supabase.rpc('set_member_active', {
      p_slug: slug,
      p_member_id: id,
      active,
    })
    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  async function handleMoveMember(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= activeMembers.length) return

    const { error } = await supabase.rpc('swap_member_order', {
      p_slug: slug,
      p_member_id_a: activeMembers[index].id,
      p_member_id_b: activeMembers[targetIndex].id,
    })

    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  function updateContactDraft(id: string, field: 'email' | 'phone', value: string) {
    setContactDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  async function handleSaveContact(id: string) {
    const draft = contactDrafts[id]
    const { error } = await supabase.rpc('update_member_contact', {
      p_slug: slug,
      p_member_id: id,
      p_email: draft.email,
      p_phone: draft.phone,
    })
    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  // --- Tasks ---

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

  function toggleTaskChecked(id: string) {
    const next = new Set(checkedTaskIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setCheckedTaskIds(next)
  }

  async function handleMoveTask(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= tasks.length) return

    const { error } = await supabase.rpc('swap_task_order', {
      p_slug: slug,
      p_task_id_a: tasks[index].id,
      p_task_id_b: tasks[targetIndex].id,
    })

    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  // --- Rotation ---

  async function handleSetRotation() {
    if (checkedTaskIds.size !== activeMembers.length) {
      setError(`Select exactly ${activeMembers.length} task(s) to match your ${activeMembers.length} active member(s).`)
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

  // --- Household code ---

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

  // --- Notify ---

  function toggleNotifyChecked(id: string) {
    const next = new Set(notifyChecked)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setNotifyChecked(next)
  }

  function getAssignedTaskName(memberId: string): string | null {
    const rotation = rotations.find((r) => r.current_member_id === memberId)
    if (!rotation) return null
    const task = tasks.find((t) => t.id === rotation.task_id)
    return task ? task.name : null
  }

  function handleSendEmail() {
    const selected = members.filter((m) => notifyChecked.has(m.id))
    for (const m of selected) {
      const taskName = getAssignedTaskName(m.id)
      if (!m.email || !taskName) continue
      const subject = encodeURIComponent(`Your task this week: ${taskName}`)
      const body = encodeURIComponent(`Hi ${m.name},\n\nYou're assigned to "${taskName}" this week.\n\nThanks!`)
      window.open(`mailto:${m.email}?subject=${subject}&body=${body}`, '_blank')
    }
  }

  function handleSendText() {
    const selected = members.filter((m) => notifyChecked.has(m.id))
    for (const m of selected) {
      const taskName = getAssignedTaskName(m.id)
      if (!m.phone || !taskName) continue
      const body = encodeURIComponent(`Hi ${m.name}, you're assigned to "${taskName}" this week.`)
      window.open(`sms:${m.phone}&body=${body}`, '_blank')
    }
  }

  function getMemberName(id: string | undefined) {
    if (!id) return 'Unassigned'
    const member = members.find((m) => m.id === id)
    return member ? member.name : 'Unassigned'
  }

  const activeMembers = members.filter((m) => m.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const inactiveMembers = members.filter((m) => !m.is_active)
  const selectedTasks = tasks.filter((t) => t.is_selected).sort((a, b) => a.sort_order - b.sort_order)
  const hasActiveRotation = selectedTasks.length > 0 && selectedTasks.length === activeMembers.length

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{householdName}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Primary view: current assignments */}
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

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Notify</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {activeMembers.map((m) => (
                <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                  <input
                    type="checkbox"
                    checked={notifyChecked.has(m.id)}
                    onChange={() => toggleNotifyChecked(m.id)}
                  />
                  <span>{m.name} — {getAssignedTaskName(m.id) || 'Unassigned'}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleSendEmail} style={{ flex: 1, padding: '0.5rem' }}>Send Email</button>
              <button onClick={handleSendText} style={{ flex: 1, padding: '0.5rem' }}>Send Text</button>
            </div>
            <p style={{ fontSize: '0.85em', color: '#666' }}>
              Opens a pre-filled message per person in your Mail/Messages app — you'll tap send on each.
              Members need an email or phone number saved below to receive a message.
            </p>
          </div>
        </section>
      )}

      {/* Setup / management */}
      <details open={!hasActiveRotation} style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold' }}>
          {hasActiveRotation ? 'Manage Members & Tasks' : 'Set Up Rotation'}
        </summary>

        <section style={{ marginTop: '1rem' }}>
          <h3>Members</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {activeMembers.map((m, i) => (
              <li key={m.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{m.name} (age {calculateAge(m.date_of_birth)})</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => handleMoveMember(i, 'up')} disabled={i === 0}>↑</button>
                    <button onClick={() => handleMoveMember(i, 'down')} disabled={i === activeMembers.length - 1}>↓</button>
                    <button onClick={() => handleToggleActive(m.id, false)}>Deactivate</button>
                    <button onClick={() => handleRemoveMember(m.id)}>Remove</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={contactDrafts[m.id]?.email || ''}
                    onChange={(e) => updateContactDraft(m.id, 'email', e.target.value)}
                    style={{ flex: 1, padding: '0.25rem' }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={contactDrafts[m.id]?.phone || ''}
                    onChange={(e) => updateContactDraft(m.id, 'phone', e.target.value)}
                    style={{ flex: 1, padding: '0.25rem' }}
                  />
                  <button onClick={() => handleSaveContact(m.id)}>Save</button>
                </div>
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
              type="date"
              value={newMemberDob}
              onChange={(e) => setNewMemberDob(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit">Add</button>
          </form>

          <button
            onClick={() => setShowInactive(!showInactive)}
            style={{ marginTop: '0.75rem', fontSize: '0.9em' }}
          >
            {showInactive ? 'Hide' : 'Show'} inactive members ({inactiveMembers.length})
          </button>

          {showInactive && (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' }}>
              {inactiveMembers.map((m) => (
                <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee', opacity: 0.6 }}>
                  <span>{m.name} (age {calculateAge(m.date_of_birth)})</span>
                  <button onClick={() => handleToggleActive(m.id, true)}>Activate</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: '1.5rem' }}>
          <h3>Tasks</h3>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            Select {activeMembers.length} task{activeMembers.length === 1 ? '' : 's'} for the current rotation.
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {tasks.map((t, i) => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={checkedTaskIds.has(t.id)}
                    onChange={() => toggleTaskChecked(t.id)}
                  />
                  {t.name}
                </label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => handleMoveTask(i, 'up')} disabled={i === 0}>↑</button>
                  <button onClick={() => handleMoveTask(i, 'down')} disabled={i === tasks.length - 1}>↓</button>
                  <button onClick={() => handleRemoveTask(t.id)}>Remove</button>
                </div>
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
            disabled={activeMembers.length === 0}
            style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem' }}
          >
            Set Rotation ({checkedTaskIds.size}/{activeMembers.length} selected)
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
