import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Input from './Input'

describe('Input alignment', () => {
  it.each(['text', 'email', 'password', 'tel', 'url'])('%s field is RTL with the icon on the right', (type) => {
    render(<Input type={type} aria-label={type} placeholder="x" icon={<svg data-testid={`i-${type}`} />} />)
    const input = screen.getByLabelText(type)
    expect(input.style.direction).toBe('rtl')
    expect(input.style.textAlign).toBe('right')
    const icon = screen.getByTestId(`i-${type}`).parentElement as HTMLElement
    expect(icon.style.right).toBe('12px')
    expect(icon.style.left).toBe('auto')
  })
})
