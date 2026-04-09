import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEventById, listEvents } from '@/lib/eventService'

const EventContext = createContext(null)

export function EventProvider({ children }) {
  const { eventId } = useParams()
  const [events, setEvents] = useState([])
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [eventsData, eventData] = await Promise.all([
        listEvents(),
        eventId ? getEventById(eventId) : Promise.resolve(null),
      ])
      setEvents(eventsData)
      setEvent(eventData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar eventos.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <EventContext.Provider value={{ events, event, eventId, loading, error, refresh }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEvent() {
  const context = useContext(EventContext)
  if (!context) throw new Error('useEvent must be used within EventProvider')
  return context
}
