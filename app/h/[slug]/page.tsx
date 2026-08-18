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

  const [showInactiveTasks, setShowInactiveTasks] = useState(false)

  const [newTaskName, setNewTaskName] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberDob, setNewMemberDob] = useState('')
  const [contactDrafts, setContactDrafts] = useState<Record<string, { email: string; phone: string }>>({})
  const [notifyEmail, setNotifyEmail] = useState<Set<string>>(new Set())
  const [notifySms, setNotifySms] = useState<Set<string>>(new Set())
  const [newCode, setNewCode] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Assignment UI state
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({})
  const [assignmentWarnings, setAssignmentWarnings] = useState<string[]>([])

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
    
    const loadedRotations = data.rotation || []
    setRotations(loadedRotations)

    // Initialize assignment drafts from current rotations
    const draftsMap: Record<string, string> = {}
    loadedTasks.forEach((t: Task) => {
      const rot = loadedRotations.find((r: Rotation) => r.task_id === t.id)
      draftsMap[t.id] = rot?.current_member_id || ''
    })
    setAssignmentDrafts(draftsMap)
  }, [slug])

  useEffect(() => {
    loadHousehold()
  }, [loadHousehold])

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

  // --- Assignments ---

  function validateAssignments(): string[] {
    const warnings: string[] = []
    const memberAssignmentCount: Record<string, number> = {}

    tasks.filter(t => t.is_selected).forEach((t) => {
      const memberId = assignmentDrafts[t.id]
      if (!memberId) {
        warnings.push(`${t.name} has no one assigned.`)
      } else {
        memberAssignmentCount[memberId] = (memberAssignmentCount[memberId] || 0) + 1
      }
    })

    Object.entries(memberAssignmentCount).forEach(([memberId, count]) => {
      if (count > 1) {
        const member = members.find((m) => m.id === memberId)
        warnings.push(`${member?.name} is assigned to multiple tasks.`)
      }
    })

    return warnings
  }

  async function handleSaveAssignments() {
    const warnings = validateAssignments()
    if (warnings.length > 0) {
      setAssignmentWarnings(warnings)
      return
    }
    setAssignmentWarnings([])

    const assignments = tasks.filter(t => t.is_selected).map((t) => ({
      task_id: t.id,
      member_id: assignmentDrafts[t.id],
    }))

    const { error } = await supabase.rpc('set_assignments', {
      p_slug: slug,
      assignments: assignments,
    })

    if (error) {
      setError(error.message)
      return
    }

    loadHousehold()
  }

  async function handleAutoAssign() {
    const activeMembers = members.filter((m) => m.is_active).sort((a, b) => a.sort_order - b.sort_order)
    const drafts: Record<string, string> = {}
    tasks.filter(t => t.is_selected).forEach((t, i) => {
      drafts[t.id] = activeMembers[i % activeMembers.length]?.id || ''
    })
    setAssignmentDrafts(drafts)
    setAssignmentWarnings([])
  }

  async function handleRotate() {
    const { error } = await supabase.rpc('rotate_all', { p_slug: slug })
    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

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

  function toggleNotifyEmail(id: string) {
    const next = new Set(notifyEmail)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setNotifyEmail(next)
  }

  function toggleNotifySms(id: string) {
    const next = new Set(notifySms)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setNotifySms(next)
  }

  function getAssignedTaskName(memberId: string): string | null {
    const rotation = rotations.find((r) => r.current_member_id === memberId)
    if (!rotation) return null
    const task = tasks.find((t) => t.id === rotation.task_id)
    return task ? task.name : null
  }

  async function handleSendNotifications() {
    // Send emails
    for (const memberId of notifyEmail) {
      const member = members.find((m) => m.id === memberId)
      const taskName = getAssignedTaskName(memberId)
      if (!member || !member.email || !taskName) continue

      const subject = encodeURIComponent(`Your task this week: ${taskName}`)
      const body = encodeURIComponent(`Hi ${member.name},\n\nYou're assigned to "${taskName}" this week.\n\nThanks!`)
      window.open(`mailto:${member.email}?subject=${subject}&body=${body}`, '_blank')
    }

    // Send texts
    for (const memberId of notifySms) {
      const member = members.find((m) => m.id === memberId)
      const taskName = getAssignedTaskName(memberId)
      if (!member || !member.phone || !taskName) continue

      const body = encodeURIComponent(`Hi ${member.name}, you're assigned to "${taskName}" this week.`)
      window.open(`sms:${member.phone}&body=${body}`, '_blank')
    }

    setNotifyEmail(new Set())
    setNotifySms(new Set())
  }

  const activeMembers = members.filter((m) => m.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const inactiveMembers = members.filter((m) => !m.is_active)

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{householdName}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Tasks & Assignments */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Tasks & Assignments</h2>

        <div style={{ marginBottom: '1rem' }}>
          <button onClick={handleAutoAssign} style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}>
            Auto-assign
          </button>
          <button onClick={handleSaveAssignments} style={{ padding: '0.5rem 1rem' }}>
            Save Assignments
          </button>
        </div>

        {assignmentWarnings.length > 0 && (
          <div style={{ backgroundColor: '#ffe6e6', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px' }}>
            <strong>Fix these issues:</strong>
            <ul style={{ margin: '0.5rem 0 0 1.5rem' }}>
              {assignmentWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Task</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Assigned to</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>Active</th>
              <th style={{ textAlign: 'center', padding: '0.5rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.filter(t => t.is_selected).map((t, i) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{t.name}</td>
                <td style={{ padding: '0.5rem' }}>
                  <select
                    value={assignmentDrafts[t.id] || ''}
                    onChange={(e) => setAssignmentDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    style={{ 
                      padding: '0.5rem', 
                      width: '100%',
                      border: '2px solid #333',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      backgroundColor: '#fff',
                      color: '#000',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    <option value="">Select member...</option>
                    {activeMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (age {calculateAge(m.date_of_birth)})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <button 
                    onClick={async () => {
                      const { error } = await supabase.rpc('toggle_task_active', {
                        p_slug: slug,
                        p_task_id: t.id,
                        p_is_selected: false,
                      })
                      if (error) {
                        setError(error.message)
                      } else {
                        loadHousehold()
                      }
                    }}
                    style={{ padding: '0.5rem' }}
                  >
                    Deactivate
                  </button>
                </td>
                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                  <button onClick={() => handleMoveTask(i, 'up')} disabled={i === 0} style={{ padding: '0.5rem', marginRight: '0.5rem' }}>↑</button>
                  <button onClick={() => handleMoveTask(i, 'down')} disabled={i === tasks.length - 1} style={{ padding: '0.5rem', marginRight: '0.5rem' }}>↓</button>
                  <button onClick={() => handleRemoveTask(t.id)} style={{ padding: '0.5rem' }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {tasks.filter(t => !t.is_selected).length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={() => setShowInactiveTasks(!showInactiveTasks)}
              style={{ fontSize: '0.9em', marginBottom: '0.5rem' }}
            >
              {showInactiveTasks ? 'Hide' : 'Show'} inactive tasks ({tasks.filter(t => !t.is_selected).length})
            </button>
            
            {showInactiveTasks && (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {tasks.filter(t => !t.is_selected).map((t) => (
                  <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee', opacity: 0.6 }}>
                    <span>{t.name}</span>
                    <button 
                      onClick={async () => {
                        const { error } = await supabase.rpc('toggle_task_active', {
                          p_slug: slug,
                          p_task_id: t.id,
                          p_is_selected: true,
                        })
                        if (error) {
                          setError(error.message)
                        } else {
                          loadHousehold()
                        }
                      }}
                      style={{ padding: '0.5rem' }}
                    >
                      Activate
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="New task name"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="submit">Add Task</button>
        </form>

        <button onClick={handleRotate} style={{ marginTop: '1rem', width: '100%', padding: '0.5rem', fontSize: '1rem' }}>
          Rotate
        </button>
      </section>

      {/* Notify */}
      <details style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}>
          Notify Members
        </summary>

        <p style={{ fontSize: '0.85em', color: '#666', marginBottom: '0.5rem' }}>
          Only one message can be sent at a time. Select either email or SMS for one member.
        </p>

        <div style={{ marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Member (Task)</th>
                <th style={{ textAlign: 'center', padding: '0.5rem' }}>Email</th>
                <th style={{ textAlign: 'center', padding: '0.5rem' }}>SMS</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {m.name} ({getAssignedTaskName(m.id) || 'Unassigned'})
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={notifyEmail.has(m.id)}
                      onChange={() => toggleNotifyEmail(m.id)}
                      disabled={!m.email}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={notifySms.has(m.id)}
                      onChange={() => toggleNotifySms(m.id)}
                      disabled={!m.phone}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleSendNotifications} style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem' }}>
            Send
          </button>
          <p style={{ fontSize: '0.85em', color: '#666', marginTop: '0.5rem' }}>
            Opens pre-filled messages in your Mail/Messages app for each selected recipient — you tap send on each.
          </p>
        </div>
      </details>

      {/* Members */}
      <details open style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}>
          Manage Members
        </summary>

        <section style={{ marginTop: '1rem' }}>
          <h3>Active Members</h3>
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
            {showInactive ? 'Hide' : 'Show'} inactive ({inactiveMembers.length})
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
          <h3>Household Code</h3>
          <p style={{ fontSize: '0.9em', color: '#666' }}>Current: {slug}</p>
          <form onSubmit={handleRenameHousehold} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="New code"
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
