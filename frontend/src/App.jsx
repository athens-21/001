import { Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from './context/AccountContext';

// Pages
import AccountLogin from './pages/AccountLogin';
import Dashboard from './pages/Dashboard';
import Journal from './pages/Journal';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

// Components
import Navbar from './components/Navbar';

function App() {
    const { isAuthenticated, loading } = useAccount();

    if (loading) {
        return (
            <div className="min-h-screen bg-bloomberg-bg flex items-center justify-center">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <Routes>
                <Route path="/account-login" element={<AccountLogin />} />
                <Route path="*" element={<Navigate to="/account-login" replace />} />
            </Routes>
        );
    }

    return (
        <div className="min-h-screen bg-bloomberg-bg">
            <Navbar />
            <main className="pt-16">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/journal" element={<Journal />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
