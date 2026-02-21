import { useState, useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import { tradesAPI } from '../services/api';
import Modal from '../components/Modal';
import { Plus, Edit, Trash2, Filter } from 'lucide-react';

export default function Journal() {
    const { user } = useAccount();
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTrade, setEditingTrade] = useState(null);
    const [filter, setFilter] = useState({ status: 'all', pair: '' });

    useEffect(() => {
        loadTrades();
    }, [filter]);

    const loadTrades = async () => {
        try {
            const params = {};
            if (filter.status !== 'all') params.status = filter.status;
            if (filter.pair) params.pair = filter.pair;

            const response = await tradesAPI.getAll(params);
            setTrades(response.data);
        } catch (error) {
            console.error('Failed to load trades:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this trade?')) return;

        try {
            await tradesAPI.delete(id);
            setTrades(trades.filter(t => t.id !== id));
        } catch (error) {
            console.error('Failed to delete trade:', error);
            alert('Failed to delete trade');
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
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-bloomberg-text-primary terminal-text">
                        Trading Journal
                    </h1>
                    <p className="text-bloomberg-text-secondary mt-1">
                        All your trades in one place
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary px-6 py-3 rounded-lg flex items-center space-x-2"
                >
                    <Plus size={20} />
                    <span>Add Trade</span>
                </button>
            </div>

            {/* Filters */}
            <div className="card-bloomberg rounded-xl p-4">
                <div className="flex items-center space-x-4">
                    <Filter size={20} className="text-bloomberg-text-muted" />
                    <select
                        value={filter.status}
                        onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                        className="px-4 py-2 rounded-lg"
                    >
                        <option value="all">All Status</option>
                        <option value="OPEN">Open</option>
                        <option value="CLOSED">Closed</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Filter by pair (e.g., EUR/USD)"
                        value={filter.pair}
                        onChange={(e) => setFilter({ ...filter, pair: e.target.value })}
                        className="px-4 py-2 rounded-lg"
                    />
                </div>
            </div>

            {/* Trades Table */}
            <div className="card-bloomberg rounded-xl p-6">
                <div className="overflow-x-auto">
                    <table className="table-bloomberg w-full">
                        <thead>
                            <tr>
                                <th>Pair</th>
                                <th>Direction</th>
                                <th>Volume</th>
                                <th>Entry</th>
                                <th>Exit</th>
                                <th>P/L</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-12 text-bloomberg-text-muted">
                                        No trades found
                                    </td>
                                </tr>
                            ) : (
                                trades.map((trade) => (
                                    <tr key={trade.id}>
                                        <td className="font-medium terminal-text">{trade.pair}</td>
                                        <td>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.direction === 'LONG'
                                                    ? 'bg-bloomberg-success/20 text-bloomberg-success'
                                                    : 'bg-bloomberg-danger/20 text-bloomberg-danger'
                                                }`}>
                                                {trade.direction}
                                            </span>
                                        </td>
                                        <td className="terminal-text">{trade.volume}</td>
                                        <td className="terminal-text">{trade.entry_price}</td>
                                        <td className="terminal-text">{trade.exit_price || '-'}</td>
                                        <td className={`font-bold terminal-text ${Number(trade.net_profit) > 0 ? 'text-bloomberg-success' :
                                                Number(trade.net_profit) < 0 ? 'text-bloomberg-danger' : ''
                                            }`}>
                                            {trade.net_profit != null ? `$${Number(trade.net_profit).toFixed(2)}` : '-'}
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 rounded text-xs ${trade.status === 'OPEN'
                                                    ? 'bg-bloomberg-info/20 text-bloomberg-info'
                                                    : 'bg-bloomberg-border text-bloomberg-text-secondary'
                                                }`}>
                                                {trade.status}
                                            </span>
                                        </td>
                                        <td className="text-sm text-bloomberg-text-muted">
                                            {new Date(trade.open_time).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => setEditingTrade(trade)}
                                                    className="p-2 rounded hover:bg-bloomberg-border"
                                                >
                                                    <Edit size={16} className="text-bloomberg-info" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(trade.id)}
                                                    className="p-2 rounded hover:bg-bloomberg-border"
                                                >
                                                    <Trash2 size={16} className="text-bloomberg-danger" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showAddModal || editingTrade !== null}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingTrade(null);
                }}
                title={editingTrade ? 'Edit Trade' : 'Add New Trade'}
            >
                <p className="text-bloomberg-text-secondary">
                    Manual trade entry form will be implemented here
                </p>
            </Modal>
        </div>
    );
}
