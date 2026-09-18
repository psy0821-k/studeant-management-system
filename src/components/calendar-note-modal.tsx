import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Button from './ui/button'
import Input from './ui/input'
import { apiClient, ApiError } from '../lib/api-client'
import type { CalendarNote } from '../types/calendar-note'

interface CalendarNoteModalProps {
  date: Date
  onClose: () => void
  onChanged: () => void
}

function formatTitle(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 일정`
}

function toDateParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function CalendarNoteModal({ date, onClose, onChanged }: CalendarNoteModalProps) {
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const dateParam = toDateParam(date)

  async function loadNotes() {
    setIsLoading(true)
    setError(null)
    try {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)
      const data = await apiClient.get<CalendarNote[]>(
        `/dashboard/notes?start=${dateParam}&end=${toDateParam(nextDay)}`,
      )
      setNotes(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '일정을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const content = newContent.trim()
    if (!content) return

    try {
      await apiClient.post('/dashboard/notes', { date: dateParam, content })
      setNewContent('')
      await loadNotes()
      onChanged()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '일정 등록에 실패했습니다.')
    }
  }

  function startEdit(note: CalendarNote) {
    setEditingId(note.id)
    setEditingContent(note.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingContent('')
  }

  async function handleSaveEdit(id: string) {
    const content = editingContent.trim()
    if (!content) return

    try {
      await apiClient.put(`/dashboard/notes/${id}`, { content })
      cancelEdit()
      await loadNotes()
      onChanged()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '일정 수정에 실패했습니다.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return
    try {
      await apiClient.delete(`/dashboard/notes/${id}`)
      await loadNotes()
      onChanged()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '일정 삭제에 실패했습니다.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-card-title text-gray-900">{formatTitle(date)}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form className="mt-4 flex gap-2" onSubmit={handleAdd}>
          <Input
            className="flex-1"
            placeholder="일정을 입력하세요"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <Button type="submit">등록</Button>
        </form>

        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-body-small text-gray-400">불러오는 중...</p>}
          {error && <p className="text-body-small text-error-500">{error}</p>}
          {!isLoading && !error && notes.length === 0 && (
            <p className="py-4 text-center text-body-small text-gray-400">등록된 일정이 없습니다.</p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
              {editingId === note.id ? (
                <>
                  <Button variant="secondary" size="sm" onClick={() => handleSaveEdit(note.id)}>
                    저장
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(note.id)}>
                    삭제
                  </Button>
                  <Input
                    className="flex-1"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(note.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    autoFocus
                  />
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-body-small text-gray-900">{note.content}</span>
                  <Button variant="secondary" size="sm" onClick={() => startEdit(note)}>
                    수정
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CalendarNoteModal
