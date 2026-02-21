export default function KPICard({ title, value, subtitle, trend, icon: Icon }) {
    const getTrendColor = () => {
        if (!trend) return 'text-bloomberg-text-secondary';
        return trend > 0 ? 'text-bloomberg-success' : trend < 0 ? 'text-bloomberg-danger' : 'text-bloomberg-text-secondary';
    };

    return (
        <div className="card-bloomberg rounded-xl p-6 transition-all hover:scale-105">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-sm font-medium text-bloomberg-text-secondary uppercase tracking-wide">
                        {title}
                    </h3>
                </div>
                {Icon && (
                    <div className="p-2 bg-bloomberg-border rounded-lg">
                        <Icon size={20} className="text-bloomberg-accent" />
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="text-3xl font-bold text-bloomberg-text-primary terminal-text">
                    {value}
                </div>

                {subtitle && (
                    <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${getTrendColor()}`}>
                            {subtitle}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
