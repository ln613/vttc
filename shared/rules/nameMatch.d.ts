export interface NameParts {
  firstName?: string | null
  lastName?: string | null
}

export declare const isSimilarName: (typed: NameParts, player: NameParts) => boolean
export declare const candidateFamilyNames: (typed: NameParts) => string[]
export declare const toTitleCase: (value: string | null | undefined) => string
