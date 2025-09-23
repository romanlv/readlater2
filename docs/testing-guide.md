# Testing Guide

Concise best practices for writing maintainable tests with **Vitest** and **React Testing Library**.

## Core Principle: Avoid DOM Dumps

Use `queryBy*` methods instead of `getBy*` or `findBy*` to prevent large DOM outputs when tests fail:

```typescript
// ✅ Good - no DOM dump on failure
expect(screen.queryByText('Article Title')).toBeTruthy()

// ❌ Bad - causes DOM dump if not found
expect(screen.getByText('Article Title')).toBeDefined()
expect(await screen.findByText('Article Title')).toBeInTheDocument()
```

## Test Setup

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
```

## Common Patterns

### Element Existence
```typescript
expect(screen.queryByText('Expected Text')).toBeTruthy()
expect(screen.queryByRole('button', { name: /save/i })).toBeTruthy()
```

### Element Properties
```typescript
const button = screen.queryByRole('button') as HTMLButtonElement
expect(button?.disabled).toBe(true)
```

### User Interactions
```typescript
const user = userEvent.setup()
await user.type(screen.queryByLabelText('Input')!, 'text')
await user.click(screen.queryByRole('button', { name: /save/i })!)
```

### Async Elements
```typescript
// For elements that appear after async operations
expect(await screen.findByText('Success')).toBeInTheDocument()
```

## Test Organization

Group related tests with `describe` blocks:

```typescript
describe('Form Submission', () => {
  test('shows success message on valid data', () => {})
  test('shows error on invalid data', () => {})
})
```

## Quick Checklist

- Use `queryBy*` for existence checks to avoid DOM dumps
- Use `findBy*` only when you need to wait for async elements
- Import from `vitest` not `jest`
- Use `userEvent.setup()` for interactions
- Group tests with `describe` blocks
- Keep test names descriptive