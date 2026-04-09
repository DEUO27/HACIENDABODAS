import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import RsvpThemeRenderer from '@/components/events/rsvp/RsvpThemeRenderer'
import { resolveRsvpToken, submitRsvp } from '@/lib/eventService'

function normalizeErrorState(error) {
  if (error instanceof Error) {
    try {
      return JSON.parse(error.message)
    } catch {
      return { message: error.message }
    }
  }

  return { message: 'No fue posible validar el enlace.' }
}

export default function RsvpPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [resolvedData, setResolvedData] = useState(null)
  const [errorState, setErrorState] = useState(null)
  const [form, setForm] = useState({
    responseStatus: 'confirmed',
    plusOnes: 0,
    comment: '',
    dietaryRestrictions: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  useEffect(() => {
    if (!token) return

    async function loadToken() {
      setLoading(true)
      try {
        const data = await resolveRsvpToken(token)
        setResolvedData(data)
        setErrorState(null)
      } catch (error) {
        setErrorState(normalizeErrorState(error))
      } finally {
        setLoading(false)
      }
    }

    loadToken()
  }, [token])

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const result = await submitRsvp({
        token,
        responseStatus: form.responseStatus,
        plusOnes: form.responseStatus === 'confirmed' ? form.plusOnes : 0,
        comment: form.comment,
        dietaryRestrictions: form.dietaryRestrictions,
      })

      setSubmitted(result)
    } catch (error) {
      setErrorState(normalizeErrorState(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RsvpThemeRenderer
      event={resolvedData?.event}
      guest={resolvedData?.guest}
      pageConfig={resolvedData?.pageConfig}
      loading={loading}
      errorState={!resolvedData ? errorState : null}
      submitted={submitted}
      form={form}
      onFormChange={setForm}
      onSubmit={handleSubmit}
      submitting={submitting}
    />
  )
}
