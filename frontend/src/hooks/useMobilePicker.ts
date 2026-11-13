import useMediaQuery from './useMediaQuery'

export default function useMobilePicker() {
  return useMediaQuery('(pointer: coarse) and (max-width: 1023px)')
}
