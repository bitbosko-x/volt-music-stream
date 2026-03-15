import React from 'react';
import { Button } from '@/components/ui/button';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 text-center">
                    <h1 className="text-4xl font-bold mb-4 text-red-500">Something went wrong.</h1>
                    <p className="text-xl mb-8">The application encountered an unexpected error.</p>

                    <div className="bg-secondary/50 p-4 rounded-md mb-8 max-w-2xl text-left overflow-auto max-h-64 w-full">
                        <p className="font-mono text-sm text-red-400 mb-2">{this.state.error && this.state.error.toString()}</p>
                        <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>

                    <Button onClick={this.handleReload} size="lg">
                        Reload Application
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
