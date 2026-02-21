import { BarChart } from 'lucide-react';

export default function Analytics() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-bloomberg-text-primary terminal-text">
                    Analytics
                </h1>
                <p className="text-bloomberg-text-secondary mt-1">
                    Advanced performance metrics and insights
                </p>
            </div>

            {/* Placeholder Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-bloomberg rounded-xl p-8 text-center">
                    <BarChart size={48} className="mx-auto text-bloomberg-accent mb-4" />
                    <h3 className="text-lg font-semibold text-bloomberg-text-primary mb-2">
                        Monthly P/L Chart
                    </h3>
                    <p className="text-bloomberg-text-muted">
                        Coming soon: Visual breakdown of monthly performance
                    </p>
                </div>

                <div className="card-bloomberg rounded-xl p-8 text-center">
                    <BarChart size={48} className="mx-auto text-bloomberg-info mb-4" />
                    <h3 className="text-lg font-semibold text-bloomberg-text-primary mb-2">
                        Symbol Performance
                    </h3>
                    <p className="text-bloomberg-text-muted">
                        Coming soon: Performance by trading pair
                    </p>
                </div>

                <div className="card-bloomberg rounded-xl p-8 text-center">
                    <BarChart size={48} className="mx-auto text-bloomberg-success mb-4" />
                    <h3 className="text-lg font-semibold text-bloomberg-text-primary mb-2">
                        Time-based Analysis
                    </h3>
                    <p className="text-bloomberg-text-muted">
                        Coming soon: Hourly performance heatmap
                    </p>
                </div>

                <div className="card-bloomberg rounded-xl p-8 text-center">
                    <BarChart size={48} className="mx-auto text-bloomberg-danger mb-4" />
                    <h3 className="text-lg font-semibold text-bloomberg-text-primary mb-2">
                        AI Insights
                    </h3>
                    <p className="text-bloomberg-text-muted">
                        Coming soon: AI-powered trading insights
                    </p>
                </div>
            </div>
        </div>
    );
}
