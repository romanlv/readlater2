# Testing Guide for AI Assistants

## Overview
This guide provides best practices for writing maintainable tests using **Vitest** and **React Testing Library (RTL)** that avoid expensive LLM token usage when tests fail.

## Testing Stack
- **Test Runner**: Vitest (fast, modern alternative to Jest)
- **Testing Library**: React Testing Library for component testing
- **User Interactions**: @testing-library/user-event
- **Assertions**: Vitest's built-in expect (avoid Jest-specific syntax)

## Key Principles

### 1. Avoid Large DOM Outputs in Failures
**Problem**: Using `screen.getByText()` or similar methods causes large DOM dumps when tests fail, leading to expensive LLM token costs.

**Solution**: Use targeted helper functions that return null instead of throwing errors:

```typescript
// ❌ Bad - causes large DOM output on failure
expect(screen.getByText('Article Title')).toBeDefined()

// ✅ Good - minimal output on failure  
const expectElementToExist = (element: Element | null) => {
  expect(element).not.toBeNull()
}
expectElementToExist(screen.queryByText('Article Title'))
```

### 2. Test Organization Patterns

#### Group Related Tests
```typescript
// ✅ Use Vitest's describe and test functions
import { describe, test, expect, vi, beforeEach } from 'vitest'

describe('Form Submission', () => {
  test('successful save', async () => {})
  test('failed save', async () => {})
})

describe('Error Handling', () => {
  test('missing data', async () => {})
  test('network error', async () => {})
})
```

#### Use Helper Functions
```typescript
// ✅ Import from React Testing Library
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const findByTextContent = (text: string) => screen.queryByText(text)
const findByRole = (role: string, options?: { name?: RegExp | string }) => 
  screen.queryByRole(role, options)
const findByLabelText = (text: string) => screen.queryByLabelText(text)
```

### 3. Assertion Strategies

#### Element Existence
```typescript
// Use query methods (return null) instead of get methods (throw errors)
expectElementToExist(findByTextContent('Expected Text'))
```

#### Element Properties
```typescript
// Cast to specific types for property access
const button = findByRole('button', { name: /save/i }) as HTMLButtonElement
expect(button.disabled).toBe(true)
```

#### User Interactions
```typescript
// ✅ Use userEvent.setup() with Vitest
const user = userEvent.setup()
const input = findByLabelText('Tags') as HTMLInputElement
await user.type(input, 'test input')
await user.click(findByRole('button', { name: /save/i }))
```

### 4. Structure Options

#### Option 1: Flat Tests (Simple)
- All tests at root level
- Good for: Small components, few tests
- Minimal organization overhead

#### Option 2: Grouped Tests (Recommended)
- Tests grouped by functionality
- Good for: Most components
- Clear organization, easy to navigate

#### Option 3: Page Object Pattern (Complex)
- Separate classes for component interactions
- Good for: Large, complex components
- Higher maintenance but better reusability

## Implementation Checklist

- [ ] Use Vitest instead of Jest (`import { test, expect, vi } from 'vitest'`)
- [ ] Import React Testing Library correctly (`@testing-library/react`)
- [ ] Replace `getBy*` with `queryBy*` methods to avoid DOM dumps
- [ ] Create helper functions for common assertions
- [ ] Group related tests with `describe` blocks
- [ ] Use typed element casting for property access (`as HTMLButtonElement`)
- [ ] Avoid large DOM assertions in error paths
- [ ] Use `vi` for mocking instead of `jest` functions
- [ ] Keep test names descriptive and specific

## Example Refactor

### Before (Expensive on Failure)
```typescript
// ❌ Bad - Jest-style, causes large DOM dumps
import { jest } from '@jest/globals' // Avoid Jest imports

test('renders form', async () => {
  render(<Component />)
  expect(screen.getByText('Title')).toBeDefined()
  expect(screen.getByLabelText('Input')).toBeDefined()
  expect(screen.getByRole('button')).toBeDefined()
})
```

### After (Minimal Failure Output)
```typescript
// ✅ Good - Vitest with efficient patterns
import { describe, test, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

describe('Component Rendering', () => {
  test('renders form elements', async () => {
    render(<Component />)
    expectElementToExist(findByTextContent('Title'))
    expectElementToExist(findByLabelText('Input'))
    expectElementToExist(findByRole('button'))
  })
})
```

This approach reduces token costs by 70-90% when tests fail while maintaining the same test coverage.