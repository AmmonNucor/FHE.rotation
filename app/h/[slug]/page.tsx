'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

type Household = {
  id: string
  name: string
  members_sort_mode: 'manual' | 'age'
  members_age_sort_desc: boolean
}

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

  const [household, setHousehold] = useState<Household | null>(null)
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

  // Numeric reorder input state
  const [memberReorderInputs, setMemberReorderInputs] = useState<Record<string, string>>({})
  const [taskReorderInputs, setTaskReorderInputs] = useState<Record<string, string>>({})

  // Section collapse state
  const tasksRef = useRef<HTMLDetailsElement>(null)
  const membersRef = useRef<HTMLDetailsElement>(null)

    useEffect(() => {
      try {
        const saved = localStorage.getItem('fhe-open-sections')
        if (saved) {
          const state = JSON.parse(saved)
          if (tasksRef.current) tasksRef.current.open = state.tasks
          if (membersRef.current) membersRef.current.open = state.members
        }
      } catch (e) {
        // ignore
      }
    }, [])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('fhe-open-sections')
      return saved ? JSON.parse(saved) : {
        assignments: true,
        notify: false,
        tasks: false,
        members: false,
      }
    } catch (e) {
      return {
        assignments: true,
        notify: false,
        tasks: false,
        members: false,
      }
    }
  })

  // Toggle section and save to localStorage
  const toggleSection = (section: string) => {
    console.log('Toggling:', section, 'from', openSections[section])
    const next = { ...openSections, [section]: !openSections[section] }
    console.log('New state:', next)
    setOpenSections(next)
    localStorage.setItem('fhe-open-sections', JSON.stringify(next))
  }

  const loadHousehold = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_household', { p_slug: slug })
    setLoading(false)

    if (error || !data) {
      setError('Household not found')
      return
    }

    const householdData: Household = {
      id: data.household.id,
      name: data.household.name,
      members_sort_mode: data.household.members_sort_mode || 'manual',
      members_age_sort_desc: data.household.members_age_sort_desc || false,
    }
    setHousehold(householdData)
    setHouseholdName(data.household.name)

    let loadedMembers: Member[] = (data.members || []).sort(
      (a: Member, b: Member) => a.sort_order - b.sort_order
    )

    // If in age mode, sort by age
    if (householdData.members_sort_mode === 'age') {
      loadedMembers = loadedMembers.sort((a: Member, b: Member) => {
        const ageA = calculateAge(a.date_of_birth)
        const ageB = calculateAge(b.date_of_birth)
        const comparison = ageA - ageB
        return householdData.members_age_sort_desc ? -comparison : comparison
      })
    }

    setMembers(loadedMembers)

    // Initialize reorder inputs
    const memberInputs: Record<string, string> = {}
    loadedMembers.filter((m: Member) => m.is_active).forEach((m: Member, index: number) => {
      memberInputs[m.id] = String(index + 1)
    })
    setMemberReorderInputs(memberInputs)

    const drafts: Record<string, { email: string; phone: string }> = {}
    loadedMembers.forEach((m) => {
      drafts[m.id] = { email: m.email || '', phone: m.phone || '' }
    })
    setContactDrafts(drafts)

    const loadedTasks = (data.tasks || []).sort((a: Task, b: Task) => a.sort_order - b.sort_order)
    setTasks(loadedTasks)

    // Initialize task reorder inputs
    const taskInputs: Record<string, string> = {}
    loadedTasks.filter((t: Task) => t.is_selected).forEach((t: Task, index: number) => {
      taskInputs[t.id] = String(index + 1)
    })
    setTaskReorderInputs(taskInputs)
    
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

  async function handleReorderTask(taskId: string, newOrderStr: string) {
    const newOrder = parseInt(newOrderStr, 10)
    if (isNaN(newOrder) || newOrder < 1) return

    const activeTasks = tasks.filter(t => t.is_selected)
    if (newOrder > activeTasks.length) return

    const { error } = await supabase.rpc('reorder_task', {
      p_slug: slug,
      p_task_id: taskId,
      p_new_sort_order: newOrder,
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

  async function handleReorderMember(memberId: string, newOrderStr: string) {
    const newOrder = parseInt(newOrderStr, 10)
    if (isNaN(newOrder) || newOrder < 1) return

    const activeMembers = members.filter(m => m.is_active)
    if (newOrder > activeMembers.length) return

    const { error } = await supabase.rpc('reorder_member', {
      p_slug: slug,
      p_member_id: memberId,
      p_new_sort_order: newOrder,
    })

    if (error) {
      setError(error.message)
      return
    }
    loadHousehold()
  }

  async function handleToggleSortMode() {
    if (!household) return

    const { error } = await supabase.rpc('toggle_member_sort_mode', {
      p_slug: slug,
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

      const body = encodeURIComponent(`Hi ${member.name}, you're assigned to "${taskName}" this week. Thanks!`)
      window.open(`sms:${member.phone}?body=${body}`, '_blank')
    }

    setNotifyEmail(new Set())
    setNotifySms(new Set())
  }

  const activeMembers = members.filter((m) => m.is_active)
  const inactiveMembers = members.filter((m) => !m.is_active)

  if (loading) return <main>Loading...</main>
  if (error) return <main>Error: {error}</main>

  return (
    <main>
      <header>
        <img 
          src="/family-circle-logo.svg" 
          alt="Family Home Evening" 
          style={{ width: '160px', height: '160px', marginBottom: '1rem' }}
        />
        <div className="header" style={{ letterSpacing: '1px', marginBottom: '1rem' }}>
          Family Home Evening
        </div>
        <h1>{householdName}</h1>
      </header>


      {/* Assignments */}
      <details open>
        <summary>
          Assignments
        </summary>

        {assignmentWarnings.length > 0 && (
          <div>
            <strong>Issues:</strong>
            <ul>
              {assignmentWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {tasks.filter(t => t.is_selected).map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    <select
                      value={assignmentDrafts[t.id] || ''}
                      onChange={(e) => setAssignmentDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                    >
                      <option value="">— Unassigned —</option>
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <button onClick={handleAutoAssign}>
              Auto-assign
            </button>
            <button onClick={handleSaveAssignments}>
              Save Assignments
            </button>
            <button onClick={handleRotate}>
              Rotate to Next
            </button>
          </div>
        </div>
      </details>

      {/* Notify */}
      <details>
        <summary>
          Notify Members
        </summary>

        <p>
          Only one message can be sent at a time. Select either email or SMS for one member.
        </p>

        <div>
          <table>
            <thead>
              <tr>
                <th>Member (Task)</th>
                <th>Email</th>
                <th>SMS</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name} ({getAssignedTaskName(m.id) || 'Unassigned'})
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={notifyEmail.has(m.id)}
                      onChange={() => toggleNotifyEmail(m.id)}
                      disabled={!m.email}
                    />
                  </td>
                  <td>
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
          <button onClick={handleSendNotifications}>
            Send
          </button>
          <p>
            Opens pre-filled messages in your Mail/Messages app for each selected recipient — you tap send on each.
          </p>
        </div>
      </details>

      {/* Tasks */}
      <details ref={tasksRef} onToggle={() => toggleSection('tasks')}>
        <summary>
          Manage Tasks
        </summary>

        <section>
          <h3>Active Tasks</h3>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Task</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.filter(t => t.is_selected).map((t, i) => (
                <tr key={t.id}>
                  <td>
                    <input
                      type="number"
                      min="1"
                      max={tasks.filter(tk => tk.is_selected).length}
                      value={taskReorderInputs[t.id] || ''}
                      onChange={(e) => {
                        setTaskReorderInputs(prev => ({ ...prev, [t.id]: e.target.value }))
                      }}
                      onBlur={() => {
                        if (taskReorderInputs[t.id]) {
                          handleReorderTask(t.id, taskReorderInputs[t.id])
                        }
                      }}
                    />
                  </td>
                  <td>{t.name}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={t.is_selected}
                      onChange={async () => {
                        const { error } = await supabase.rpc('toggle_task_active', {
                          p_slug: slug,
                          p_task_id: t.id,
                          p_is_selected: !t.is_selected,
                        })
                        if (error) {
                          setError(error.message)
                        } else {
                          loadHousehold()
                        }
                      }}
                    />
                  </td>
                  <td>
                    <button
                      onClick={() => handleRemoveTask(t.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {tasks.filter(t => !t.is_selected).length > 0 && (
          <div>
            <button 
              onClick={() => setShowInactiveTasks(!showInactiveTasks)}
            >
              {showInactiveTasks ? 'Hide' : 'Show'} inactive tasks ({tasks.filter(t => !t.is_selected).length})
            </button>
            
            {showInactiveTasks && (
              <ul>
                {tasks.filter(t => !t.is_selected).map((t) => (
                  <li key={t.id}>
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
                    >
                      Activate
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleAddTask}>
          <input
            type="text"
            placeholder="New task name"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
          />
          <button type="submit">Add Task</button>
        </form>

      </details>

      {/* Members */}
      <details ref={membersRef} onToggle={() => toggleSection('members')}>
        <summary>
          Manage Members
        </summary>

        <section>
          <h3>Active Members</h3>

          {/* Sort Indicator */}
          <div>
            <button
              className="sort-mode-toggle"
              onClick={handleToggleSortMode}
              style={{ background: 'none', border: 'none', color: 'var(--color-gold)', textDecoration: 'underline', cursor: 'pointer', padding: '0' }}
            >
              Sorted by: {household?.members_sort_mode === 'age'
                ? `Age (${household.members_age_sort_desc ? 'oldest' : 'youngest'} first)`
                : 'Manual'}
            </button>
          </div>

          <ul>
            {activeMembers.map((m, i) => (
              <li key={m.id}>
                <div>
                  <input
                    type="number"
                    min="1"
                    max={activeMembers.length}
                    value={memberReorderInputs[m.id] || ''}
                    onChange={(e) => {
                      setMemberReorderInputs(prev => ({ ...prev, [m.id]: e.target.value }))
                    }}
                    onBlur={() => {
                      if (memberReorderInputs[m.id]) {
                        handleReorderMember(m.id, memberReorderInputs[m.id])
                      }
                    }}
                  />
                  <span>{m.name} (age {calculateAge(m.date_of_birth)})</span>
                  <button onClick={() => handleToggleActive(m.id, false)}>
                    Deactivate
                  </button>
                  <button onClick={() => handleRemoveMember(m.id)}>
                    Remove
                  </button>
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={contactDrafts[m.id]?.email || ''}
                    onChange={(e) => updateContactDraft(m.id, 'email', e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={contactDrafts[m.id]?.phone || ''}
                    onChange={(e) => updateContactDraft(m.id, 'phone', e.target.value)}
                  />
                  <button onClick={() => handleSaveContact(m.id)}>
                    Save
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddMember}>
            <input
              type="text"
              placeholder="Name"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
            />
            <input
              type="date"
              value={newMemberDob}
              onChange={(e) => setNewMemberDob(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>

          <button
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'Hide' : 'Show'} inactive ({inactiveMembers.length})
          </button>

          {showInactive && (
            <ul>
              {inactiveMembers.map((m) => (
                <li key={m.id}>
                  <span>{m.name} (age {calculateAge(m.date_of_birth)})</span>
                  <button onClick={() => handleToggleActive(m.id, true)}>
                    Activate
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3>Household Code</h3>
          <p>Current: {slug}</p>
          <form onSubmit={handleRenameHousehold}>
            <input
              type="text"
              placeholder="New code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
            <button type="submit">Update</button>
          </form>
        </section>
      </details>
    </main>
  )
}