import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import ApiHealthBanner from './components/ApiHealthBanner'

const root = createRoot(document.getElementById('root')!)
root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(ErrorBoundary, null,
      React.createElement(ApiHealthBanner, null),
      React.createElement(App, null)
    )
  )
)
