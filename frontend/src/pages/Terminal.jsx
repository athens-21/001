import { useState } from 'react';
import { commandsAPI } from '../services/api';
import { Terminal as TerminalIcon, ChevronRight } from 'lucide-react';

export default function Terminal() {
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([
        { command: 'help', result: 'Available commands will be listed here', status: 'success' },
    ]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        // Add command to history
        setHistory([...history, { command, result: 'Processing...', status: 'pending' }]);

        try {
            const response = await commandsAPI.execute(command);
            setHistory(prev => [
                ...prev.slice(0, -1),
                { command, result: response.data.result, status: 'success' }
            ]);
        } catch (error) {
            setHistory(prev => [
                ...prev.slice(0, -1),
                { command, result: 'Command failed', status: 'error' }
            ]);
        }

        setCommand('');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="card-bloomberg rounded-xl p-6">
                {/* Header */}
                <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-bloomberg-border">
                    <TerminalIcon size={24} className="text-bloomberg-accent" />
                    <h1 className="text-xl font-bold text-bloomberg-text-primary terminal-text">
                        Trading Terminal
                    </h1>
                </div>

                {/* Command History */}
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                    {history.map((entry, index) => (
                        <div key={index} className="space-y-2">
                            <div className="flex items-center space-x-2 text-bloomberg-accent terminal-text">
                                <ChevronRight size={16} />
                                <span>{entry.command}</span>
                            </div>
                            <div className={`pl-6 text-sm terminal-text ${entry.status === 'error'
                                    ? 'text-bloomberg-danger'
                                    : 'text-bloomberg-text-secondary'
                                }`}>
                                {entry.result}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Command Input */}
                <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                    <ChevronRight size={20} className="text-bloomberg-accent" />
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Enter command..."
                        className="flex-1 bg-transparent border-none outline-none text-bloomberg-text-primary terminal-text"
                    />
                </form>

                {/* Help Text */}
                <div className="mt-6 pt-4 border-t border-bloomberg-border">
                    <p className="text-xs text-bloomberg-text-muted">
                        Type 'help' for available commands • Feature in development
                    </p>
                </div>
            </div>
        </div>
    );
}
