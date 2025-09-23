import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the workbox modules
vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: vi.fn(),
  createHandlerBoundToURL: vi.fn(() => 'mock-handler'),
  precacheAndRoute: vi.fn(),
}));

vi.mock('workbox-core', () => ({
  clientsClaim: vi.fn(),
}));

vi.mock('workbox-routing', () => ({
  NavigationRoute: vi.fn(),
  registerRoute: vi.fn(),
}));

// Mock ServiceWorkerGlobalScope
const mockClients = {
  matchAll: vi.fn(),
};

const mockSelf = {
  clients: mockClients,
  addEventListener: vi.fn(),
  skipWaiting: vi.fn(),
  __WB_MANIFEST: [],
  location: {
    origin: 'https://example.com',
    href: 'https://example.com/sw.js',
  },
};

// Mock environment
vi.mock('import.meta', () => ({
  env: {
    DEV: false,
  },
}));

global.self = mockSelf as unknown as ServiceWorkerGlobalScope;

describe('Service Worker', () => {
  let fetchEventListener: (event: Event) => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockClients.matchAll.mockResolvedValue([]);
    
    // Import the service worker module
    await import('@/sw');
    
    // Get the fetch event listener
    const fetchCall = mockSelf.addEventListener.mock.calls.find(
      call => call[0] === 'fetch'
    );
    if (fetchCall) {
      fetchEventListener = fetchCall[1];
    }
  });

  test('registers fetch event listener', () => {
    expect(mockSelf.addEventListener).toHaveBeenCalledWith('fetch', expect.any(Function));
  });

  test('handles Web Share Target POST request', async () => {

    const mockFormData = new Map([
      ['title', 'Test Article'],
      ['text', 'Test description'],
      ['url', 'https://example.com'],
    ]);

    const mockRequest = {
      method: 'POST',
      url: 'https://example.com/',
      formData: vi.fn().mockResolvedValue(mockFormData),
    };

    const mockEvent = {
      request: mockRequest,
      respondWith: vi.fn(),
    };

    fetchEventListener(mockEvent);

    expect(mockEvent.respondWith).toHaveBeenCalledWith(expect.any(Promise));
  });

  test('extracts form data correctly from share target', async () => {

    const mockFormData = new Map([
      ['title', 'Test Article'],
      ['text', 'Test description'],
      ['url', 'https://example.com'],
    ]);

    mockFormData.entries = function* () {
      yield ['title', 'Test Article'];
      yield ['text', 'Test description'];
      yield ['url', 'https://example.com'];
    };

    mockFormData.get = function(key: string) {
      const entries = Array.from(this.entries());
      const entry = entries.find(([k]) => k === key);
      return entry ? entry[1] : null;
    };

    const mockRequest = {
      method: 'POST',
      url: 'https://example.com/',
      formData: vi.fn().mockResolvedValue(mockFormData),
    };

    const mockEvent = {
      request: mockRequest,
      respondWith: vi.fn(),
    };

    fetchEventListener(mockEvent);

    const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
    
    // Mock Response.redirect
    global.Response = {
      redirect: vi.fn().mockReturnValue('redirect-response'),
    } as unknown as typeof Response;

    const originalURL = global.URL;
    global.URL = vi.fn().mockImplementation((url) => ({
      pathname: new originalURL(url).pathname,
    })) as unknown as typeof URL;

    await respondWithPromise;
    
    expect(global.Response.redirect).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/?share_target=1#title=Test%20Article&text=Test%20description&url=https%3A%2F%2Fexample.com'),
      303
    );
  });

  test('handles invalid URL in form data', async () => {

    const mockFormData = new Map([
      ['title', 'Test Article'],
      ['text', 'invalid-url'],
      ['url', 'not-a-valid-url'],
    ]);

    mockFormData.entries = function* () {
      yield ['title', 'Test Article'];
      yield ['text', 'invalid-url'];
      yield ['url', 'not-a-valid-url'];
    };

    mockFormData.get = function(key: string) {
      const entries = Array.from(this.entries());
      const entry = entries.find(([k]) => k === key);
      return entry ? entry[1] : null;
    };

    const mockRequest = {
      method: 'POST',
      url: 'https://example.com/',
      formData: vi.fn().mockResolvedValue(mockFormData),
    };

    const mockEvent = {
      request: mockRequest,
      respondWith: vi.fn(),
    };

    fetchEventListener(mockEvent);

    const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
    
    global.Response = {
      redirect: vi.fn().mockReturnValue('redirect-response'),
    } as unknown as typeof Response;

    const originalURL = global.URL;
    global.URL = vi.fn().mockImplementation((url) => {
      if (url === 'not-a-valid-url') {
        throw new Error('Invalid URL');
      }
      return { pathname: new originalURL(url).pathname };
    }) as unknown as typeof URL;

    await respondWithPromise;
    
    expect(global.Response.redirect).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/?share_target=1#title=Test%20Article&text=invalid-url&url='),
      303
    );
  });

  test('handles form data extraction error', async () => {

    const mockRequest = {
      method: 'POST',
      url: 'https://example.com/',
      formData: vi.fn().mockRejectedValue(new Error('Form data error')),
    };

    const mockEvent = {
      request: mockRequest,
      respondWith: vi.fn(),
    };

    fetchEventListener(mockEvent);

    const respondWithPromise = mockEvent.respondWith.mock.calls[0][0];
    
    global.Response = {
      redirect: vi.fn().mockReturnValue('redirect-response'),
    } as unknown as typeof Response;

    const originalURL = global.URL;
    global.URL = vi.fn().mockImplementation((url) => ({
      pathname: new originalURL(url).pathname,
    })) as unknown as typeof URL;

    await respondWithPromise;
    
    expect(global.Response.redirect).toHaveBeenCalledWith(
      'https://example.com/?share_target=1#error=processing_failed',
      303
    );
  });

  test('ignores non-POST requests', async () => {

    const mockRequest = {
      method: 'GET',
      url: 'https://example.com/',
    };

    const mockEvent = {
      request: mockRequest,
      respondWith: vi.fn(),
    };

    fetchEventListener(mockEvent);

    expect(mockEvent.respondWith).not.toHaveBeenCalled();
  });

  test('ignores POST requests to non-root paths', async () => {

    const mockRequest = {
      method: 'POST',
      url: 'https://example.com/other-path',
    };

    const mockEvent = {
      request: mockRequest,
      respondWith: vi.fn(),
    };

    const originalURL = global.URL;
    global.URL = vi.fn().mockImplementation((url) => ({
      pathname: new originalURL(url).pathname,
    })) as unknown as typeof URL;

    fetchEventListener(mockEvent);

    expect(mockEvent.respondWith).not.toHaveBeenCalled();
  });
});