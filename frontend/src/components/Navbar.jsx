import { Link, useLocation } from 'react-router-dom';
import { useAccount } from '../context/AccountContext';
import { LayoutDashboard, BookOpen, BarChart3, Settings, LogOut } from 'lucide-react';

export default function Navbar() {
    const { user, logout } = useAccount();
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/settings', label: 'Settings', icon: Settings },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="fixed top-0 left-0 right-0 bg-bloomberg-secondary border-b border-bloomberg-border z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center space-x-8">
                        <div className="text-xl font-bold text-bloomberg-accent terminal-text">
                            TJ<span className="text-bloomberg-text-primary">|</span>TERMINAL
                        </div>

                        {/* Nav Links */}
                        <div className="hidden md:flex space-x-1">
                            {navItems.map(({ path, label, icon: Icon }) => (
                                <Link
                                    key={path}
                                    to={path}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${isActive(path)
                                            ? 'bg-bloomberg-accent text-white'
                                            : 'text-bloomberg-text-secondary hover:text-bloomberg-text-primary hover:bg-bloomberg-border'
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span className="font-medium">{label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* User Info & Logout */}
                    <div className="flex items-center space-x-4">
                        <div className="hidden sm:block text-right">
                            <div className="text-sm font-medium text-bloomberg-text-primary">
                                {user?.accountName || `Account ${user?.accountNumber}`}
                            </div>
                            <div className="text-xs text-bloomberg-text-muted terminal-text">
                                #{user?.accountNumber}
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-bloomberg-border hover:bg-red-500/20 text-bloomberg-text-secondary hover:text-bloomberg-danger transition-all"
                        >
                            <LogOut size={18} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
