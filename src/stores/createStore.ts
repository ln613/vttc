import { useSyncExternalStore } from 'react'

export interface Store<T> {
  getState: () => T
  setState: (newState: Partial<T> | ((prev: T) => Partial<T>)) => void
  subscribe: (listener: () => void) => () => void
  useStore: () => T
  useSelector: <S>(selector: (state: T) => S) => S
}

export const createStore = <T extends object>(initialState: T): Store<T> => {
  let state = initialState
  const listeners = new Set<() => void>()

  const getState = () => state

  const setState = (newState: Partial<T> | ((prev: T) => Partial<T>)) => {
    const updates = typeof newState === 'function' ? newState(state) : newState
    state = { ...state, ...updates }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const useStore = () => useSyncExternalStore(subscribe, getState, getState)

  const useSelector = <S>(selector: (state: T) => S): S =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    )

  return { getState, setState, subscribe, useStore, useSelector }
}

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export const createAsyncState = <T>(): AsyncState<T> => ({
  data: null,
  loading: false,
  error: null,
})
