export interface Player {
  id: string
  firstName: string
  lastName: string
  rating: number
  dateOfBirth?: string // ISO date string for age calculation
  sex?: 'male' | 'female'
}
