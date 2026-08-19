import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('SafeRoute ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReload = () => {
    // Clear potentially corrupt session data
    try {
      localStorage.removeItem('sr_parent_token');
    } catch (e) {}
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-red-500/50 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4">
            <div className="text-5xl mb-2">⚠️</div>
            <h1 className="text-2xl font-black text-white">SafeRoute Crashed</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Something went wrong while loading the app. This is usually caused by a connection issue with the backend server.
            </p>
            
            {this.state.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left">
                <p className="text-[11px] text-red-400 font-mono break-all">
                  {String(this.state.error?.message || this.state.error).slice(0, 200)}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 py-3 rounded-xl font-bold text-sm transition-all"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                Reload App
              </button>
            </div>

            <p className="text-[10px] text-slate-500 pt-2">
              If this keeps happening, make sure the backend server is running on port 3001.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
