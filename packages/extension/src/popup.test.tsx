import { expect, test, vi, beforeEach, describe } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Popup from './popup'
import type { ArticleData, SaveArticleResponse } from '@readlater/core'

// Test utilities
const expectElementToExist = (element: Element | null) => {
  expect(element).not.toBeNull()
}

const findByTextContent = (text: string) => {
  return screen.queryByText(text)
}

const findByRole = (role: string, options?: { name?: RegExp | string }) => {
  return screen.queryByRole(role, options)
}

const findByLabelText = (text: string) => {
  return screen.queryByLabelText(text)
}

// Mock Chrome APIs
const mockChrome = {
  tabs: {
    query: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  },
  runtime: {
    sendMessage: vi.fn()
  }
}

global.chrome = mockChrome as unknown as typeof chrome

const mockPageData: ArticleData = {
  url: 'https://example.com/article',
  title: 'Test Article Title',
  description: 'Test article description',
  featuredImage: 'https://example.com/image.jpg',
  timestamp: '2023-01-01T00:00:00.000Z',
  domain: 'example.com',
  tags: [],
  notes: '',
  archived: false,
  favorite: false
}

beforeEach(() => {
  vi.clearAllMocks()
  
  // Default successful page data extraction
  mockChrome.tabs.query.mockResolvedValue([{ id: 1 }])
  mockChrome.scripting.executeScript.mockResolvedValue([{ result: mockPageData }])
})

describe('Popup Rendering', () => {
  test("renders popup with page data and form fields", async () => {
    render(<Popup />)

    // Wait for page data to load
    await waitFor(() => {
      expectElementToExist(findByTextContent('Test Article Title'))
    })

    // Check essential elements exist without full DOM assertion
    expectElementToExist(findByTextContent('ReadLater'))
    expectElementToExist(findByTextContent('https://example.com/article'))
    expectElementToExist(findByLabelText('Tags (comma-separated)'))
    expectElementToExist(findByLabelText('Notes'))
    expectElementToExist(findByRole('button', { name: /save article/i }))
    expectElementToExist(findByRole('button', { name: /cancel/i }))
  })

  test("handles page data extraction failure", async () => {
    mockChrome.tabs.query.mockRejectedValue(new Error('Tab query failed'))
    
    render(<Popup />)

    await waitFor(() => {
      expectElementToExist(findByTextContent('Error loading page data'))
    })
  })
})


describe('Form Submission', () => {
  test("enter tags and notes then save successfully", async () => {
    const user = userEvent.setup()
    const mockSaveResponse: SaveArticleResponse = {
      success: true,
      message: 'Article saved successfully'
    }
    mockChrome.runtime.sendMessage.mockResolvedValue(mockSaveResponse)

    render(<Popup />)

    // Wait for page data to load
    await waitFor(() => {
      expectElementToExist(findByTextContent('Test Article Title'))
    })

    // Enter tags and notes
    const tagsInput = findByLabelText('Tags (comma-separated)') as HTMLInputElement
    const notesInput = findByLabelText('Notes') as HTMLInputElement
    
    await user.type(tagsInput, 'tech, article, important')
    await user.type(notesInput, 'This is a test note')

    // Submit form
    const saveButton = findByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for success message
    await waitFor(() => {
      expectElementToExist(findByTextContent('Article saved successfully!'))
    })

    // Verify runtime message was sent with correct data
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'saveArticle',
      articleData: {
        ...mockPageData,
        tags: ['tech', 'article', 'important'],
        notes: 'This is a test note'
      }
    })
  })

  test("save failed with error message", async () => {
    const user = userEvent.setup()
    const mockSaveResponse: SaveArticleResponse = {
      success: false,
      message: 'Failed to save article',
      error: 'Network error'
    }
    mockChrome.runtime.sendMessage.mockResolvedValue(mockSaveResponse)

    render(<Popup />)

    // Wait for page data to load
    await waitFor(() => {
      expectElementToExist(findByTextContent('Test Article Title'))
    })

    // Submit form
    const saveButton = findByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for error message
    await waitFor(() => {
      expectElementToExist(findByTextContent('Failed to save article'))
    })

    // Button should be enabled again
    expect(saveButton.disabled).toBe(false)
  })

  test("save failed with runtime error", async () => {
    const user = userEvent.setup()
    mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Runtime error'))

    render(<Popup />)

    // Wait for page data to load
    await waitFor(() => {
      expectElementToExist(findByTextContent('Test Article Title'))
    })

    // Submit form
    const saveButton = findByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for error message
    await waitFor(() => {
      expectElementToExist(findByTextContent('Failed to save article'))
    })
  })
})

describe('Error Handling', () => {
  test("handles missing page data on save", async () => {
    const user = userEvent.setup()
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: null }])

    render(<Popup />)

    // Wait for component to render
    await waitFor(() => {
      expectElementToExist(findByRole('button', { name: /save article/i }))
    })

    // Try to submit form
    const saveButton = findByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Should show error message
    await waitFor(() => {
      expectElementToExist(findByTextContent('No page data available'))
    })
  })
})

describe('User Interactions', () => {
  test("cancel button closes window", async () => {
    const user = userEvent.setup()
    const mockWindowClose = vi.fn()
    window.close = mockWindowClose

    render(<Popup />)

    const cancelButton = findByRole('button', { name: /cancel/i }) as HTMLButtonElement
    await user.click(cancelButton)

    expect(mockWindowClose).toHaveBeenCalled()
  })

test("automatically closes window after successful save", async () => {
  const user = userEvent.setup()
  const mockWindowClose = vi.fn()
  window.close = mockWindowClose
  
  const mockSaveResponse: SaveArticleResponse = {
    success: true,
    message: 'Article saved successfully'
  }
  mockChrome.runtime.sendMessage.mockResolvedValue(mockSaveResponse)

  render(<Popup />)

  // Wait for page data to load
  await waitFor(() => {
    expectElementToExist(findByTextContent('Test Article Title'))
  })

  // Submit form
  const saveButton = findByRole('button', { name: /save article/i }) as HTMLButtonElement
  await user.click(saveButton)

  // Wait for success message
  await waitFor(() => {
    expectElementToExist(findByTextContent('Article saved successfully!'))
  })

  // Wait for window to close (with timeout)
  await waitFor(() => {
    expect(mockWindowClose).toHaveBeenCalled()
  }, { timeout: 2000 })
})

test("tags input handles empty and whitespace values", async () => {
  const user = userEvent.setup()
  const mockSaveResponse: SaveArticleResponse = {
    success: true,
    message: 'Article saved successfully'
  }
  mockChrome.runtime.sendMessage.mockResolvedValue(mockSaveResponse)

  render(<Popup />)

  // Wait for page data to load
  await waitFor(() => {
    expectElementToExist(findByTextContent('Test Article Title'))
  })

  // Enter tags with extra whitespace
  const tagsInput = findByLabelText('Tags (comma-separated)') as HTMLInputElement
  await user.type(tagsInput, '  tech  ,  article  ,  ')

  // Submit form
  const saveButton = findByRole('button', { name: /save article/i }) as HTMLButtonElement
  await user.click(saveButton)

  // Verify runtime message was sent with trimmed tags (empty string remains)
  expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
    action: 'saveArticle',
    articleData: {
      ...mockPageData,
      tags: ['tech', 'article', ''],
      notes: ''
    }
  })
})
})