import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../context/AccountContext';
import { TrendingUp } from 'lucide-react';

export default function AccountLogin() {
    const [accountNumber, setAccountNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAccount();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!accountNumber.trim()) {
            setError('Please enter your MT5 account number');
            return;
        }

        setLoading(true);
        const result = await login(accountNumber);
        setLoading(false);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-bloomberg-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-bloomberg-accent rounded-xl mb-4">
                        <TrendingUp size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-bloomberg-text-primary terminal-text mb-2">
                        Trading Journal
                    </h1>
                </div>

                {/* Login Form */}
                <div className="card-bloomberg rounded-xl p-8">
                    <h2 className="text-xl font-bold text-bloomberg-text-primary mb-6">
                        MT5 Account Login
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="accountNumber" className="block text-sm font-medium text-bloomberg-text-secondary mb-2">
                                MT5 Account Number
                            </label>
                            <input
                                id="accountNumber"
                                type="text"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                placeholder="Enter your MT5 account number"
                                className="w-full px-4 py-3 rounded-lg terminal-text focus:ring-2 focus:ring-bloomberg-accent"
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-bloomberg-danger/10 border border-bloomberg-danger rounded-lg">
                                <p className="text-sm text-bloomberg-danger">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Logging in...' : 'Login to Dashboard'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-bloomberg-border">
                        <p className="text-xs text-bloomberg-text-muted text-center">
                            Enter your MT5 account number to access your trading data and analytics.
                            <br />
                            If the account doesn't exist, it will be created automatically.
                        </p>
                    </div>
                </div>

                <div className="mt-6 text-center text-xs text-bloomberg-text-muted">
                    <p>🔒 Secure connection • Real-time MT5 sync</p>
                </div>
            </div>
        </div>
    );
}
