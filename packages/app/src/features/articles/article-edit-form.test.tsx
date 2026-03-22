import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleEditForm } from './article-edit-form';

describe('ArticleEditForm', () => {
  const defaultProps = {
    initialData: {
      url: 'https://example.com/article',
      title: 'Test Article',
      description: 'A test description',
      notes: 'Some notes',
      tags: ['tech', 'ai'],
    },
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  test('renders all form fields', () => {
    render(<ArticleEditForm {...defaultProps} />);

    expect(screen.queryByLabelText('URL')).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeTruthy();
    expect(screen.queryByLabelText('Description')).toBeTruthy();
    expect(screen.queryByLabelText('Notes')).toBeTruthy();
    expect(screen.queryByLabelText('Tags')).toBeTruthy();
  });

  test('populates fields with initial data', () => {
    render(<ArticleEditForm {...defaultProps} />);

    const urlInput = screen.queryByLabelText('URL') as HTMLInputElement;
    const titleInput = screen.queryByLabelText('Title') as HTMLInputElement;
    const tagsInput = screen.queryByLabelText('Tags') as HTMLInputElement;

    expect(urlInput?.value).toBe('https://example.com/article');
    expect(titleInput?.value).toBe('Test Article');
    expect(tagsInput?.value).toBe('tech, ai');
  });

  test('disables URL field in edit mode', () => {
    render(<ArticleEditForm {...defaultProps} mode="edit" />);

    const urlInput = screen.queryByLabelText('URL') as HTMLInputElement;
    expect(urlInput?.disabled).toBe(true);
  });

  test('enables URL field in create mode', () => {
    render(<ArticleEditForm {...defaultProps} mode="create" />);

    const urlInput = screen.queryByLabelText('URL') as HTMLInputElement;
    expect(urlInput?.disabled).toBe(false);
  });

  test('shows Save Article button in create mode', () => {
    render(<ArticleEditForm {...defaultProps} mode="create" />);

    expect(screen.queryByText('Save Article')).toBeTruthy();
  });

  test('shows Update Article button in edit mode', () => {
    render(<ArticleEditForm {...defaultProps} mode="edit" />);

    expect(screen.queryByText('Update Article')).toBeTruthy();
  });

  test('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(<ArticleEditForm {...defaultProps} onCancel={onCancel} />);

    const user = userEvent.setup();
    await user.click(screen.queryByText('Cancel')!);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('calls onSave with form data on submit', async () => {
    const onSave = vi.fn();
    render(<ArticleEditForm {...defaultProps} onSave={onSave} />);

    const user = userEvent.setup();
    await user.click(screen.queryByText('Save Article')!);

    expect(onSave).toHaveBeenCalledWith({
      url: 'https://example.com/article',
      title: 'Test Article',
      description: 'A test description',
      notes: 'Some notes',
      tags: ['tech', 'ai'],
    });
  });

  test('parses comma-separated tags on submit', async () => {
    const onSave = vi.fn();
    render(
      <ArticleEditForm
        {...defaultProps}
        initialData={{ ...defaultProps.initialData, tags: [] }}
        onSave={onSave}
      />
    );

    const user = userEvent.setup();
    const tagsInput = screen.queryByLabelText('Tags')!;
    await user.type(tagsInput, 'react, typescript, testing');
    await user.click(screen.queryByText('Save Article')!);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: ['react', 'typescript', 'testing'],
      })
    );
  });

  test('disables save button when URL is empty', () => {
    render(
      <ArticleEditForm
        {...defaultProps}
        initialData={{ ...defaultProps.initialData, url: '' }}
      />
    );

    const saveButton = screen.queryByText('Save Article') as HTMLButtonElement;
    expect(saveButton?.disabled).toBe(true);
  });

  test('disables buttons when loading', () => {
    render(<ArticleEditForm {...defaultProps} isLoading={true} />);

    expect(screen.queryByText('Saving...')).toBeTruthy();
    const cancelButton = screen.queryByText('Cancel') as HTMLButtonElement;
    expect(cancelButton?.disabled).toBe(true);
  });

  test('handles empty initial data', () => {
    render(
      <ArticleEditForm
        initialData={{}}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const urlInput = screen.queryByLabelText('URL') as HTMLInputElement;
    const titleInput = screen.queryByLabelText('Title') as HTMLInputElement;
    expect(urlInput?.value).toBe('');
    expect(titleInput?.value).toBe('');
  });
});
