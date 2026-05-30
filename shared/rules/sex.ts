export type FormSex = 'male' | 'female' | ''

export type DbSex = 'M' | 'F'

export const normalizeSex = (raw: string | undefined): FormSex => {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'm' || value === 'male') return 'male'
  if (value === 'f' || value === 'female') return 'female'
  return ''
}

export const toDbSex = (sex: FormSex): DbSex | undefined => {
  if (sex === 'male') return 'M'
  if (sex === 'female') return 'F'
  return undefined
}
