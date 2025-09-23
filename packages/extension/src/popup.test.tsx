import { expect, test, vi, beforeEach, describe } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Popup from './popup'
import type { ArticleData, SaveArticleResponse } from '@readlater/core'

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

  // Suppress expected console errors
  vi.spyOn(console, 'error').mockImplementation(() => {});
})

describe('Popup Rendering', () => {
  test("renders popup with page data and form fields", async () => {
    render(<Popup />)

    // Wait for page data to load
    await waitFor(() => {
      expect(screen.queryByText('Test Article Title')).toBeTruthy()
    })

    // Check essential elements exist without full DOM assertion
    expect(screen.queryByText('ReadLater')).toBeTruthy()
    expect(screen.queryByText('https://example.com/article')).toBeTruthy()
    expect(screen.queryByLabelText('Tags (comma-separated)')).toBeTruthy()
    expect(screen.queryByLabelText('Notes')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /save article/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeTruthy()
  })

  test("handles page data extraction failure", async () => {
    mockChrome.tabs.query.mockRejectedValue(new Error('Tab query failed'))

    render(<Popup />)

    await waitFor(() => {
      expect(screen.queryByText('Error loading page data')).toBeTruthy()
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
      expect(screen.queryByText('Test Article Title')).toBeTruthy()
    })

    // Enter tags and notes
    const tagsInput = screen.queryByLabelText('Tags (comma-separated)') as HTMLInputElement
    const notesInput = screen.queryByLabelText('Notes') as HTMLInputElement

    await user.type(tagsInput, 'tech, article, important')
    await user.type(notesInput, 'This is a test note')

    // Submit form
    const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for success message
    await waitFor(() => {
      expect(screen.queryByText('Article saved successfully!')).toBeTruthy()
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
      expect(screen.queryByText('Test Article Title')).toBeTruthy()
    })

    // Submit form
    const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for error message
    await waitFor(() => {
      expect(screen.queryByText('Failed to save article')).toBeTruthy()
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
      expect(screen.queryByText('Test Article Title')).toBeTruthy()
    })

    // Submit form
    const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for error message
    await waitFor(() => {
      expect(screen.queryByText('Failed to save article')).toBeTruthy()
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
      expect(screen.queryByRole('button', { name: /save article/i })).toBeTruthy()
    })

    // Try to submit form
    const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Should show error message
    await waitFor(() => {
      expect(screen.queryByText('No page data available')).toBeTruthy()
    })
  })
})

describe('User Interactions', () => {
  test("cancel button closes window", async () => {
    const user = userEvent.setup()
    const mockWindowClose = vi.fn()
    window.close = mockWindowClose

    render(<Popup />)

    const cancelButton = screen.queryByRole('button', { name: /cancel/i }) as HTMLButtonElement
    await user.click(cancelButton)

    expect(mockWindowClose).toHaveBeenCalled()
  })

test("save button wires to the sync engine", async () => {
    const user = userEvent.setup()
    const mockSaveResponse: SaveArticleResponse = {
      success: true,
      message: 'Article saved successfully'
    }
    mockChrome.runtime.sendMessage.mockResolvedValue(mockSaveResponse)

    render(<Popup />)

    // Wait for page data to load
    await waitFor(() => {
      expect(screen.queryByText('Test Article Title')).toBeTruthy()
    })

    // Submit form
    const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
    await user.click(saveButton)

    // Wait for success message
    await waitFor(() => {
      expect(screen.queryByText('Article saved successfully!')).toBeTruthy()
    })

    // Verify runtime message was sent with correct data
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'saveArticle',
      articleData: {
        ...mockPageData,
        tags: [],
        notes: ''
      }
    })
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
    expect(screen.queryByText('Test Article Title')).toBeTruthy()
  })

  // Submit form
  const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
  await user.click(saveButton)

  // Wait for success message
  await waitFor(() => {
    expect(screen.queryByText('Article saved successfully!')).toBeTruthy()
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
    expect(screen.queryByText('Test Article Title')).toBeTruthy()
  })

  // Enter tags with extra whitespace
  const tagsInput = screen.queryByLabelText('Tags (comma-separated)') as HTMLInputElement
  await user.type(tagsInput, '  tech  ,  article  ,  ')

  // Submit form
  const saveButton = screen.queryByRole('button', { name: /save article/i }) as HTMLButtonElement
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