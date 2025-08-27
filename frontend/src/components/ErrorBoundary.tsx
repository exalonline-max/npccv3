import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props)
    this.state = { hasError: false, message: null }
  }
  static getDerivedStateFromError(error){
    return { hasError: true, message: String(error) }
  }
  componentDidCatch(error, info){
    console.error('Unhandled error in React tree', error, info)
  }
  render(){
    if (this.state.hasError){
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl bg-base-100 rounded p-6 shadow">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted">An unexpected error occurred. Check the console for details.</p>
            <div className="mt-4 text-sm text-red-600">{this.state.message}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
