import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors so a single broken view can never blank the whole
 * app. Users get a readable message and a way to recover without a hard reload.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the technical detail in the console for developers; the UI stays calm.
    console.error('[Naafay] Unhandled UI error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isUrdu = document.documentElement.lang !== 'en';

    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-base font-bold text-[#111C18]">
            {isUrdu ? 'کچھ غلط ہو گیا' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm text-[#4A5D55]">
            {isUrdu
              ? 'صفحہ لوڈ کرنے میں غیر متوقع دشواری پیش آئی۔ دوبارہ کوشش کریں۔'
              : 'An unexpected error occurred while rendering this page. Please try again.'}
          </p>
          <pre className="mt-3 max-h-24 overflow-auto rounded bg-[#F6F8F7] p-2 text-start text-[11px] text-[#5A6D65]">
            {error.message}
          </pre>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{isUrdu ? 'دوبارہ کوشش کریں' : 'Try again'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-[#DCE4E0] px-4 py-2 text-xs font-medium text-[#374841] hover:bg-[#F6F8F7]"
            >
              {isUrdu ? 'صفحہ دوبارہ کھولیں' : 'Reload page'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
