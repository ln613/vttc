export interface Player {
  _id: string
  firstName: string
  lastName: string
  rating: number
  dateOfBirth?: string // ISO date string for age calculation
  sex?: 'male' | 'female'
  email?: string
  phone?: string
  password?: string
  hasAccount?: boolean
}
