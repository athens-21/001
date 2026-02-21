import { useState, useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import { accountsAPI, settingsAPI } from '../services/api';
import { Settings as SettingsIcon, User, Database, Bell } from 'lucide-react';

export default function Settings() {
    const { user } = useAccount();
    const [accountData, setAccountData] = useState({
        account_name: '',
        broker: '',
        account_type: 'DEMO',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadAccountData();
    }, [user]);

    const loadAccountData = async () => {
        try {
            const response = await accountsAPI.getById(user.accountId);
            setAccountData({
                account_name: response.data.account_name || '',
                broker: response.data.broker || '',
                account_type: response.data.account_type || 'DEMO',
            });
        } catch (error) {
            console.error('Failed to load account data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await accountsAPI.update(user.accountId, accountData);
            alert('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-bloomberg-text-primary terminal-text">
                    Settings
                </h1>
                <p className="text-bloomberg-text-secondary mt-1">
                    Manage your account and preferences
                </p>
            </div>

            {/* Account Information */}
            <div className="card-bloomberg rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <User size={24} className="text-bloomberg-accent" />
                    <h2 className="text-xl font-bold text-bloomberg-text-primary">
                        Account Information
                    </h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-bloomberg-text-secondary mb-2">
                            Account Number
                        </label>
                        <input
                            type="text"
                            value={user.accountNumber}
                            disabled
                            className="w-full px-4 py-3 rounded-lg opacity-60 cursor-not-allowed terminal-text"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-bloomberg-text-secondary mb-2">
                            Account Name
                        </label>
                        <input
                            type="text"
                            value={accountData.account_name}
                            onChange={(e) => setAccountData({ ...accountData, account_name: e.target.value })}
                            placeholder="My Trading Account"
                            className="w-full px-4 py-3 rounded-lg"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-bloomberg-text-secondary mb-2">
                                Broker
                            </label>
                            <input
                                type="text"
                                value={accountData.broker}
                                onChange={(e) => setAccountData({ ...accountData, broker: e.target.value })}
                                placeholder="Your broker name"
                                className="w-full px-4 py-3 rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-bloomberg-text-secondary mb-2">
                                Account Type
                            </label>
                            <select
                                value={accountData.account_type}
                                onChange={(e) => setAccountData({ ...accountData, account_type: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg"
                            >
                                <option value="DEMO">Demo</option>
                                <option value="LIVE">Live</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Display Preferences */}
            <div className="card-bloomberg rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-6">
                    <Database size={24} className="text-bloomberg-info" />
                    <h2 className="text-xl font-bold text-bloomberg-text-primary">
                        Display Preferences
                    </h2>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-bloomberg-border rounded-lg">
                        <div>
                            <div className="font-medium text-bloomberg-text-primary">Theme</div>
                            <div className="text-sm text-bloomberg-text-muted">Bloomberg Terminal (Default)</div>
                        </div>
                        <div className="px-4 py-2 bg-bloomberg-accent text-white rounded-lg font-semibold">
                            Active
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bloomberg-border rounded-lg">
                        <div>
                            <div className="font-medium text-bloomberg-text-primary">Currency Format</div>
                            <div className="text-sm text-bloomberg-text-muted">USD ($)</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-8 py-3 rounded-lg disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
