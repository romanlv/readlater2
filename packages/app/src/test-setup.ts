// Test setup file for vitest
import * as React from 'react'
import 'fake-indexeddb/auto'

// Global React for JSX
global.React = React

// Setup window.location for tests (required for react-router)
Object.defineProperty(window, 'location', {
  value: {
    search: '',
    hash: '',
    pathname: '/',
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
  },
  writable: true,
  configurable: true,
})