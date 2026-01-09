import React, { useState } from 'react'
import { Header } from '../components/Header'
import Input from '../components/Input'
import SingleSelectTags from '../components/SingleSelectTags'
import DatePicker from '../components/DatePicker'
import MediaUpload from '../components/MediaUpload'
import Button from '../components/Button'

interface TournamentEditProps {
  isEdit?: boolean
  initialData?: {
    name: string
    type: string
    date: Date | null
    cover: File | string | null
  }
  onSave?: (data: {
    name: string
    type: string
    date: Date | null
    cover: File | string | null
  }) => void
  onCancel?: () => void
}

const TournamentEdit: React.FC<TournamentEditProps> = ({
  isEdit = false,
  initialData,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || '')
  const [type, setType] = useState(initialData?.type || 'Single')
  const [date, setDate] = useState<Date | null>(initialData?.date || null)
  const [cover, setCover] = useState<File | string | null>(
    initialData?.cover || null,
  )

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
    maxWidth: '600px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 700,
    textAlign: 'left',
    marginBottom: '24px',
    color: '#333',
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginTop: '24px',
  }

  const validateForm = (): boolean => {
    if (!name.trim()) {
      return false
    }
    return true
  }

  const handleSave = () => {
    if (!validateForm()) {
      return
    }
    onSave?.({ name, type, date, cover })
  }

  const handleCancel = () => {
    onCancel?.()
  }

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>
          {isEdit ? 'Edit Tournament' : 'Add Tournament'}
        </h1>
        <Input
          label="Name"
          name="name"
          value={name}
          onChange={setName}
          required
        />
        <SingleSelectTags
          label="Type"
          options={['Single', 'Team']}
          selectedValue={type}
          onChange={setType}
        />
        <DatePicker label="Date" value={date} onChange={setDate} />
        <MediaUpload label="Cover" value={cover} onChange={setCover} />
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={handleCancel}>
            Cancel
          </Button>
          <Button color="#3498db" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TournamentEdit
