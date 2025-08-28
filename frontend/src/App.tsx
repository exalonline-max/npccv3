import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import { Navigate } from 'react-router-dom'
import ToastProvider from './components/ToastProvider'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthPage/>} />
          <Route path="/dashboard" element={localStorage.getItem('token') ? <Dashboard/> : <Navigate to='/' replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
