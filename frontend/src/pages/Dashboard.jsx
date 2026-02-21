import { useState, useEffect, useMemo } from 'react';
import { useAccount } from '../context/AccountContext';
import { accountsAPI, tradesAPI } from '../services/api';
import KPICard from '../components/KPICard';
import {
    TrendingUp, TrendingDown, DollarSign, Target,
    Activity, Award, AlertCircle, ChevronLeft, ChevronRight,
    BarChart3, PieChart, Calendar, Filter, Edit, Trash2, Plus, X,
    Maximize2, Minimize2
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
    ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie,
    ReferenceLine, ComposedChart, Area
} from 'recharts';

export default function Dashboard() {
    const { user } = useAccount();
    const [stats, setStats] = useState(null);
    const [allTrades, setAllTrades] = useState([]);
    const [filteredTrades, setFilteredTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentLeftCardIndex, setCurrentLeftCardIndex] = useState(0); // Left cards carousel
    const [currentBottomCardIndex, setCurrentBottomCardIndex] = useState(0); // Bottom charts carousel
    const [currentKpiPageIndex, setCurrentKpiPageIndex] = useState(0); // KPI cards carousel
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [filter, setFilter] = useState({ status: 'all', pair: '', session: 'all' });
    const [customColumns, setCustomColumns] = useState(() => {
        const saved = localStorage.getItem('tradingJournalColumns');
        return saved ? JSON.parse(saved) : [];
    });
    const [showColumnModal, setShowColumnModal] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [newColumnType, setNewColumnType] = useState('text');
    const [editingCell, setEditingCell] = useState(null);
    const [customData, setCustomData] = useState(() => {
        const saved = localStorage.getItem('tradingJournalCustomData');
        return saved ? JSON.parse(saved) : {};
    });
    const [isJournalFullscreen, setIsJournalFullscreen] = useState(false);
    const [accountInfo, setAccountInfo] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentFullscreenPage, setCurrentFullscreenPage] = useState(1);
    const tradesPerPage = 10;
    const [lastTradeCount, setLastTradeCount] = useState(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Memoized journal analytics calculation for performance
    const journalAnalytics = useMemo(() => {
        const closedTrades = filteredTrades.filter(t => t.status === 'CLOSED');
        const initialBalance = user?.initialBalance || 10000;
        const currentBalance = user?.currentBalance || user?.balance || 10000;
        
        if (closedTrades.length === 0) {
            return {
                accountBalance: Number(currentBalance) || 0,
                accumulativeReturnNet: 0, accumulativeReturnGross: 0,
                dailyReturn: 0, weeklyReturn: 0, monthlyReturn: 0,
                returnOnWinners: 0, returnOnLosers: 0,
                returnOnLong: 0, returnOnShort: 0, biggestProfit: 0, biggestLoss: 0,
                profitLossRatio: 0, tradeExpectancy: 0, profitFactor: 0,
                winPercent: 0, lossPercent: 0, bePercent: 0, openPercent: 0,
                accumulativeReturnPercent: 0, biggestProfitPercent: 0, biggestLossPercent: 0,
                returnPerShare: 0, kellyCriterion: 0,
                avgReturn: 0, returnPerSize: 0, avgWinAmount: 0, avgLossAmount: 0,
                avgDailyPL: 0, avgPositionMfe: 0, avgPositionMae: 0,
                avgReturnPercent: 0, avgWinPercent: 0, avgLossPercent: 0,
                avgLongPercent: 0, avgShortPercent: 0,
                trades: []
            };
        }

        const wins = closedTrades.filter(t => Number(t.net_profit || 0) > 0);
        const losses = closedTrades.filter(t => Number(t.net_profit || 0) < 0);
        const breakevens = closedTrades.filter(t => Number(t.net_profit || 0) === 0);
        const longTrades = closedTrades.filter(t => t.direction === 'LONG');
        const shortTrades = closedTrades.filter(t => t.direction === 'SHORT');

        const totalProfit = closedTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
        const totalGrossProfit = closedTrades.reduce((sum, t) => sum + Number(t.gross_profit || t.net_profit || 0), 0);
        const totalCommission = closedTrades.reduce((sum, t) => sum + Number(t.commission || 0), 0);
        const totalSwap = closedTrades.reduce((sum, t) => sum + Number(t.swap || 0), 0);

        const winProfit = wins.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
        const lossProfit = Math.abs(losses.reduce((sum, t) => sum + Number(t.net_profit || 0), 0));
        const longProfit = longTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
        const shortProfit = shortTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);

        const winRate = (wins.length / closedTrades.length) * 100;
        const lossRate = (losses.length / closedTrades.length) * 100;
        const avgWin = wins.length > 0 ? winProfit / wins.length : 0;
        const avgLoss = losses.length > 0 ? lossProfit / losses.length : 0;

        const profitFactor = lossProfit > 0 ? winProfit / lossProfit : 0;
        const tradeExpectancy = (winRate / 100 * avgWin) - (lossRate / 100 * avgLoss);
        const kellyCriterion = lossProfit > 0 ? (winRate / 100) - ((1 - winRate / 100) / (winProfit / lossProfit)) : 0;

        const biggestProfit = wins.length > 0 ? Math.max(...wins.map(t => Number(t.net_profit || 0))) : 0;
        const biggestLoss = losses.length > 0 ? Math.min(...losses.map(t => Number(t.net_profit || 0))) : 0;

        const accumulativeReturnPercent = (totalProfit / initialBalance) * 100;
        const biggestProfitPercent = (biggestProfit / initialBalance) * 100;
        const biggestLossPercent = (biggestLoss / initialBalance) * 100;

        const uniqueDays = new Set(closedTrades.map(t => new Date(t.close_time).toDateString())).size;
        const avgDailyPL = uniqueDays > 0 ? totalProfit / uniqueDays : 0;
        const dailyReturn = avgDailyPL;

        // Calculate weekly and monthly returns
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const weeklyTrades = closedTrades.filter(t => new Date(t.close_time) >= sevenDaysAgo);
        const monthlyTrades = closedTrades.filter(t => new Date(t.close_time) >= thirtyDaysAgo);
        
        const weeklyReturn = weeklyTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
        const monthlyReturn = monthlyTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);

        const totalVolume = closedTrades.reduce((sum, t) => sum + Number(t.volume || 0), 0);
        const returnPerSize = totalVolume > 0 ? totalProfit / totalVolume : 0;
        const returnPerShare = returnPerSize;

        const avgPositionMfe = closedTrades.reduce((sum, t) => sum + Math.abs(Number(t.net_profit || 0)), 0) / closedTrades.length * 0.2;
        const avgPositionMae = closedTrades.reduce((sum, t) => sum + Math.abs(Number(t.net_profit || 0)), 0) / closedTrades.length * -0.2;

        const avgReturnPercent = (totalProfit / closedTrades.length / initialBalance) * 100;
        const avgWinPercent = wins.length > 0 ? (winProfit / wins.length / initialBalance) * 100 : 0;
        const avgLossPercent = losses.length > 0 ? (lossProfit / losses.length / initialBalance) * 100 * -1 : 0;
        const avgLongPercent = longTrades.length > 0 ? (longProfit / longTrades.length / initialBalance) * 100 : 0;
        const avgShortPercent = shortTrades.length > 0 ? (shortProfit / shortTrades.length / initialBalance) * 100 : 0;

        return {
            accountBalance: Number(currentBalance) || 0,
            accumulativeReturnNet: totalProfit,
            accumulativeReturnGross: totalGrossProfit,
            dailyReturn,
            weeklyReturn,
            monthlyReturn,
            returnOnWinners: winProfit,
            returnOnLosers: -lossProfit,
            returnOnLong: longProfit,
            returnOnShort: shortProfit,
            biggestProfit,
            biggestLoss,
            profitLossRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
            tradeExpectancy,
            profitFactor,
            winPercent: winRate,
            lossPercent: lossRate,
            bePercent: (breakevens.length / closedTrades.length) * 100,
            openPercent: 0,
            accumulativeReturnPercent,
            biggestProfitPercent,
            biggestLossPercent,
            returnPerShare,
            kellyCriterion: kellyCriterion * 100,
            avgReturn: totalProfit / closedTrades.length,
            returnPerSize,
            avgWinAmount: avgWin,
            avgLossAmount: -avgLoss,
            avgDailyPL,
            avgPositionMfe,
            avgPositionMae,
            avgReturnPercent,
            avgWinPercent,
            avgLossPercent,
            avgLongPercent,
            avgShortPercent,
            trades: closedTrades
        };
    }, [filteredTrades, user]);

    // Calendar helper functions
    const calculatePips = (trade) => {
        if (!trade.entry_price || !trade.exit_price) return 0;
        
        const priceDiff = trade.direction === 'LONG' 
            ? (trade.exit_price - trade.entry_price)
            : (trade.entry_price - trade.exit_price);
        
        // For JPY pairs, 1 pip = 0.01, for others 1 pip = 0.0001
        const isJPYPair = trade.pair?.includes('JPY');
        const pipValue = isJPYPair ? 0.01 : 0.0001;
        
        return Number((priceDiff / pipValue).toFixed(1));
    };

    const getWeekNumber = (date) => {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    };

    // Helper function to generate sparkline data from trades
    const generateSparklineData = (trades, metric = 'cumulative') => {
        if (!trades || trades.length === 0) {
            return Array(20).fill(0).map((_, i) => ({ x: i, y: 0 }));
        }

        const sortedTrades = [...trades].sort((a, b) => 
            new Date(a.close_time) - new Date(b.close_time)
        );

        const last20 = sortedTrades.slice(-20);
        
        return last20.map((trade, i) => {
            let y = 0;
            
            switch(metric) {
                case 'cumulative':
                    y = sortedTrades.slice(0, sortedTrades.indexOf(trade) + 1)
                        .reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
                    break;
                case 'individual':
                    y = Number(trade.net_profit || 0);
                    break;
                case 'percent':
                    y = (Number(trade.net_profit || 0) / (user?.initialBalance || 10000)) * 100;
                    break;
                default:
                    y = Number(trade.net_profit || 0);
            }
            
            return { x: i, y };
        });
    };

    useEffect(() => {
        if (user) {
            // Initial load with sync
            loadData(false, true);
            
            // Smart polling - check for new data every 3 seconds
            // Only update UI when data actually changes
            const interval = setInterval(async () => {
                try {
                    const tradesRes = await tradesAPI.getAll({ limit: 100 });
                    const newTradeCount = tradesRes.data.length;
                    
                    // Only reload if trade count changed
                    if (newTradeCount !== lastTradeCount) {
                        console.log('📊 New trade detected! Updating... (', newTradeCount, 'trades)');
                        setLastTradeCount(newTradeCount);
                        loadData(true); // Background refresh
                    }
                } catch (error) {
                    console.error('Failed to check for updates:', error);
                }
            }, 3000); // Check every 3 seconds
            
            return () => clearInterval(interval);
        }
    }, [user, lastTradeCount]);

    useEffect(() => {
        applyFilters();
    }, [filter, allTrades]);

    const loadData = async (isBackgroundRefresh = false, isFirstLoad = false) => {
        if (!user) return;
        
        if (!isBackgroundRefresh) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }
        
        try {
            const [statsRes, tradesRes, accountRes] = await Promise.all([
                accountsAPI.getStats(user.accountId),
                tradesAPI.getAll({ limit: 100 }),
                accountsAPI.getById(user.accountId)
            ]);
            setStats(statsRes.data);
            setAllTrades(tradesRes.data);
            setAccountInfo(accountRes.data);
            setLastTradeCount(tradesRes.data.length);
            
            if (isFirstLoad) {
                console.log('✅ Initial load completed:', tradesRes.data.length, 'trades');
                console.log('🔄 Auto-sync enabled - Will update when new trades detected');
            } else if (!isBackgroundRefresh) {
                console.log('📊 Data refreshed:', tradesRes.data.length, 'trades');
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            if (isFirstLoad) {
                setIsInitialLoad(false);
            }
        }
    };

    const addCustomColumn = () => {
        if (!newColumnName.trim()) return;
        const newColumn = {
            id: Date.now().toString(),
            name: newColumnName,
            type: newColumnType
        };
        const updatedColumns = [...customColumns, newColumn];
        setCustomColumns(updatedColumns);
        localStorage.setItem('tradingJournalColumns', JSON.stringify(updatedColumns));
        setNewColumnName('');
        setNewColumnType('text');
        setShowColumnModal(false);
    };

    const removeCustomColumn = (columnId) => {
        const updatedColumns = customColumns.filter(col => col.id !== columnId);
        setCustomColumns(updatedColumns);
        localStorage.setItem('tradingJournalColumns', JSON.stringify(updatedColumns));
        
        // Remove data for this column
        const updatedData = { ...customData };
        Object.keys(updatedData).forEach(tradeId => {
            if (updatedData[tradeId][columnId]) {
                delete updatedData[tradeId][columnId];
            }
        });
        setCustomData(updatedData);
        localStorage.setItem('tradingJournalCustomData', JSON.stringify(updatedData));
    };

    const updateCustomData = (tradeId, columnId, value) => {
        const updatedData = {
            ...customData,
            [tradeId]: {
                ...(customData[tradeId] || {}),
                [columnId]: value
            }
        };
        setCustomData(updatedData);
        localStorage.setItem('tradingJournalCustomData', JSON.stringify(updatedData));
    };

    const renderCustomCell = (trade, column) => {
        const value = customData[trade.id]?.[column.id] || '';
        const isEditing = editingCell?.tradeId === trade.id && editingCell?.columnId === column.id;

        if (isEditing) {
            switch (column.type) {
                case 'number':
                    return (
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => updateCustomData(trade.id, column.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="input-bloomberg px-1 py-0.5 w-full text-[9px]"
                            autoFocus
                        />
                    );
                case 'select':
                    return (
                        <select
                            value={value}
                            onChange={(e) => {
                                updateCustomData(trade.id, column.id, e.target.value);
                                setEditingCell(null);
                            }}
                            onBlur={() => setEditingCell(null)}
                            className="input-bloomberg px-1 py-0.5 w-full text-[9px]"
                            autoFocus
                        >
                            <option value="">-</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    );
                case 'checkbox':
                    return (
                        <input
                            type="checkbox"
                            checked={value === 'true'}
                            onChange={(e) => {
                                updateCustomData(trade.id, column.id, e.target.checked.toString());
                                setEditingCell(null);
                            }}
                            className="w-3 h-3"
                        />
                    );
                case 'date':
                    return (
                        <input
                            type="date"
                            value={value}
                            onChange={(e) => updateCustomData(trade.id, column.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="input-bloomberg px-1 py-0.5 w-full text-[9px]"
                            autoFocus
                        />
                    );
                default:
                    return (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => updateCustomData(trade.id, column.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="input-bloomberg px-1 py-0.5 w-full text-[9px]"
                            autoFocus
                        />
                    );
            }
        }

        return (
            <div
                onClick={() => setEditingCell({ tradeId: trade.id, columnId: column.id })}
                className="cursor-pointer hover:bg-bloomberg-bg-tertiary/30 px-1 py-0.5 min-h-[20px]"
            >
                {column.type === 'checkbox' 
                    ? (value === 'true' ? '☑' : '☐')
                    : (value || '-')
                }
            </div>
        );
    };

    const applyFilters = () => {
        let filtered = [...allTrades];

        if (filter.status !== 'all') {
            filtered = filtered.filter(t => t.status === filter.status);
        }

        if (filter.pair) {
            filtered = filtered.filter(t =>
                t.pair?.toLowerCase().includes(filter.pair.toLowerCase())
            );
        }

        if (filter.session !== 'all') {
            filtered = filtered.filter(t => t.session === filter.session);
        }

        // Sort by most recent first (latest open_time or close_time)
        filtered.sort((a, b) => {
            const timeA = new Date(a.close_time || a.open_time);
            const timeB = new Date(b.close_time || b.open_time);
            return timeB - timeA; // Descending order (newest first)
        });

        setFilteredTrades(filtered);
    };

    const handleDeleteTrade = async (id) => {
        if (!confirm('Are you sure you want to delete this trade?')) return;

        try {
            await tradesAPI.delete(id);
            // Reload data after delete
            await loadData();
            alert('Trade deleted successfully');
        } catch (error) {
            console.error('Failed to delete trade:', error);
            alert('Failed to delete trade: ' + (error.response?.data?.error || error.message));
        }
    };

    if (loading) {
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bloomberg-accent mx-auto mb-4"></div>
                    <p className="text-bloomberg-text-secondary">Loading dashboard...</p>
                </div>
            </div>
        );
    }

        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="spinner"></div>
            </div>
        );
    }

    const kpis = [
        {
            title: 'Total Trades',
            value: stats?.totalTrades || 0,
            subtitle: `${stats?.winningTrades || 0} wins / ${stats?.losingTrades || 0} losses`,
            icon: Activity,
        },
        {
            title: 'Win Rate',
            value: `${stats?.winRate || 0}%`,
            subtitle: stats?.winRate > 50 ? 'Above average' : 'Need improvement',
            icon: Target,
            trend: stats?.winRate > 50 ? 1 : stats?.winRate < 50 ? -1 : 0,
        },
        {
            title: 'Total P/L',
            value: `$${Number(stats?.totalProfitLoss || 0).toFixed(2)}`,
            subtitle: stats?.totalProfitLoss > 0 ? 'Profitable' : 'In Loss',
            icon: DollarSign,
            trend: stats?.totalProfitLoss > 0 ? 1 : stats?.totalProfitLoss < 0 ? -1 : 0,
        },
        {
            title: 'Avg Win',
            value: `$${Number(stats?.avgWin || 0).toFixed(2)}`,
            subtitle: `Avg Loss: $${Math.abs(Number(stats?.avgLoss || 0)).toFixed(2)}`,
            icon: TrendingUp,
        },
        {
            title: 'Profit Factor',
            value: Number(stats?.profitFactor || 0).toFixed(2),
            subtitle: stats?.profitFactor > 1 ? 'Positive edge' : 'Negative edge',
            icon: Award,
            trend: stats?.profitFactor > 1 ? 1 : stats?.profitFactor < 1 ? -1 : 0,
        },
        {
            title: 'Best Trade',
            value: `$${Number(stats?.bestTrade || 0).toFixed(2)}`,
            subtitle: `Worst: $${Number(stats?.worstTrade || 0).toFixed(2)}`,
            icon: TrendingDown,
        },
    ];

    // Analytics data calculations
    const calculateEquityData = () => {
        // Get initial balance from user account or default to 10000
        const accountBalance = user?.currentBalance || user?.balance || 10000;
        const closedTrades = filteredTrades.filter(t => t.status === 'CLOSED' && t.close_time);
        
        if (closedTrades.length === 0) {
            // Return just starting point if no trades
            return [{
                date: 'Start',
                balance: accountBalance,
                equity: accountBalance,
                trade: 0
            }];
        }
        
        // Sort trades by close time
        const sortedTrades = [...closedTrades].sort((a, b) => 
            new Date(a.close_time) - new Date(b.close_time)
        );
        
        // Calculate starting balance by working backwards from current balance
        const totalPL = sortedTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
        const initialBalance = accountBalance - totalPL;
        
        // Build equity curve
        let runningBalance = initialBalance;
        const dataPoints = [{
            date: new Date(sortedTrades[0].close_time).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            }),
            balance: Number(initialBalance.toFixed(2)),
            equity: Number(initialBalance.toFixed(2)),
            trade: 0
        }];
        
        // Add each trade sequentially
        sortedTrades.forEach((trade, idx) => {
            const profit = Number(trade.net_profit || 0);
            runningBalance += profit;
            
            const tradeDate = new Date(trade.close_time);
            const dateLabel = `${tradeDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            })} ${tradeDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            })}`;
            
            dataPoints.push({
                date: dateLabel,
                balance: Number(runningBalance.toFixed(2)),
                equity: Number(runningBalance.toFixed(2)),
                trade: idx + 1,
                profit: profit,
                pair: trade.pair
            });
        });
        
        console.log('Equity Data:', {
            tradesCount: sortedTrades.length,
            initialBalance,
            finalBalance: runningBalance,
            totalPL,
            dataPoints: dataPoints.length
        });
        
        return dataPoints;
    };

    const calculateRiskRewardData = () => {
        const closedTrades = filteredTrades.filter(t => 
            t.status === 'CLOSED' && 
            t.entry_price && 
            t.exit_price && 
            Number(t.net_profit || 0) !== 0
        );
        
        const tradeData = closedTrades.map(trade => {
            const entryPrice = Number(trade.entry_price || 0);
            const exitPrice = Number(trade.exit_price || 0);
            const stopLoss = Number(trade.stop_loss || 0);
            const takeProfit = Number(trade.take_profit || 0);
            const profit = Number(trade.net_profit || 0);
            const isWin = profit > 0;
            const pips = calculatePips(trade);
            
            // Calculate actual R:R from SL and TP if available
            let rr = 1;
            if (stopLoss && takeProfit && entryPrice) {
                let riskDistance = 0;
                let rewardDistance = 0;
                
                if (trade.direction === 'LONG') {
                    riskDistance = Math.abs(entryPrice - stopLoss);
                    rewardDistance = Math.abs(takeProfit - entryPrice);
                } else {
                    riskDistance = Math.abs(stopLoss - entryPrice);
                    rewardDistance = Math.abs(entryPrice - takeProfit);
                }
                
                if (riskDistance > 0) {
                    rr = rewardDistance / riskDistance;
                }
            } else {
                // Fallback: estimate from profit
                const avgRisk = Math.abs(profit * 0.5);
                const reward = Math.abs(profit);
                rr = avgRisk > 0 ? (reward / avgRisk) : 1;
            }
            
            const clampedRR = Math.min(Math.max(rr, 0.1), 10);
            
            return {
                rr: clampedRR,
                isWin: isWin,
                profit: profit,
                pips: Number(pips.toFixed(1)),
                pair: trade.pair,
                ticket: trade.mt5_ticket
            };
        });

        // Calculate win rate for each R:R bucket (grouped by 0.5 intervals)
        const rrBuckets = {};
        tradeData.forEach(trade => {
            const bucket = (Math.floor(trade.rr * 2) / 2).toFixed(1); // Round to nearest 0.5
            if (!rrBuckets[bucket]) {
                rrBuckets[bucket] = { wins: 0, total: 0, trades: [] };
            }
            rrBuckets[bucket].total++;
            if (trade.isWin) rrBuckets[bucket].wins++;
            rrBuckets[bucket].trades.push(trade);
        });

        // Create scatter data with actual win rate per bucket
        const scatterData = tradeData.map(trade => {
            const bucket = (Math.floor(trade.rr * 2) / 2).toFixed(1);
            const bucketData = rrBuckets[bucket];
            const actualWinRate = (bucketData.wins / bucketData.total) * 100;
            
            // Add slight random spread for better visibility
            const spread = (Math.random() - 0.5) * 5;
            const winRate = Math.max(0, Math.min(100, actualWinRate + spread));
            
            return {
                ...trade,
                winRate: Number(winRate.toFixed(1))
            };
        });

        // Create trend line from bucket averages
        const trendLineData = Object.entries(rrBuckets)
            .map(([rr, data]) => ({
                rr: Number(rr),
                winRate: Number(((data.wins / data.total) * 100).toFixed(1)),
                count: data.total
            }))
            .sort((a, b) => a.rr - b.rr);

        return { scatter: scatterData, trendLine: trendLineData };
    };

    const calculateAssetAllocation = () => {
        const assetCounts = { Forex: 0, Crypto: 0, Other: 0 };
        const symbolCounts = {};
        const manualVsEA = { Manual: 0, EA: 0 };
        const profitBySymbol = {};
        const feesBySymbol = {};
        
        filteredTrades.filter(t => t.status === 'CLOSED').forEach(trade => {
            // Asset type
            const pair = trade.pair || '';
            if (pair.includes('BTC') || pair.includes('ETH') || pair.includes('USDT')) {
                assetCounts.Crypto++;
            } else if (pair.includes('/')) {
                assetCounts.Forex++;
            } else {
                assetCounts.Other++;
            }
            
            // Symbol volume
            symbolCounts[pair] = (symbolCounts[pair] || 0) + Number(trade.volume || 0);
            
            // Manual vs EA (based on source or notes)
            if (trade.source === 'MT5') {
                manualVsEA.EA++;
            } else {
                manualVsEA.Manual++;
            }
            
            // Profit by symbol
            const profit = Number(trade.net_profit || 0);
            profitBySymbol[pair] = (profitBySymbol[pair] || 0) + profit;
            
            // Fees by symbol (commission + swap)
            const fees = Math.abs(Number(trade.commission || 0)) + Math.abs(Number(trade.swap || 0));
            feesBySymbol[pair] = (feesBySymbol[pair] || 0) + fees;
        });
        
        return {
            assets: Object.entries(assetCounts).map(([name, value]) => ({ name, value })),
            symbols: Object.entries(symbolCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
            manualEA: Object.entries(manualVsEA).map(([name, value]) => ({ name, value })),
            profitBySymbol: Object.entries(profitBySymbol)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
            feesBySymbol: Object.entries(feesBySymbol)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        };
    };

    const calculateCumulativePL = () => {
        const sortedTrades = [...filteredTrades]
            .filter(t => t.status === 'CLOSED')
            .sort((a, b) => new Date(a.close_time) - new Date(b.close_time));
        
        let cumulative = 0;
        return sortedTrades.map(trade => {
            cumulative += Number(trade.net_profit || 0);
            return {
                date: new Date(trade.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                pl: Number(cumulative.toFixed(2))
            };
        });
    };

    const calculatePerformanceHistogram = () => {
        const dailyPL = {};
        const dailyStats = {};
        
        filteredTrades.filter(t => t.status === 'CLOSED').forEach(trade => {
            const date = new Date(trade.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const profit = Number(trade.net_profit || 0);
            const commission = Math.abs(Number(trade.commission || 0));
            const swap = Number(trade.swap || 0);
            
            if (!dailyStats[date]) {
                dailyStats[date] = {
                    profit: 0,
                    loss: 0,
                    commission: 0,
                    swap: 0,
                    dividends: 0
                };
            }
            
            if (profit >= 0) {
                dailyStats[date].profit += profit;
            } else {
                dailyStats[date].loss += Math.abs(profit);
            }
            dailyStats[date].commission += commission;
            dailyStats[date].swap += swap;
        });
        
        return Object.entries(dailyStats).map(([date, stats]) => ({
            date,
            profit: Number(stats.profit.toFixed(2)),
            loss: Number(stats.loss.toFixed(2)),
            commission: Number(stats.commission.toFixed(2)),
            swap: Number(stats.swap.toFixed(2)),
            dividends: Number(stats.dividends.toFixed(2))
        }));
    };

    const calculateMonthlyPerformance = () => {
        const monthlyStats = {};
        
        filteredTrades.filter(t => t.status === 'CLOSED').forEach(trade => {
            const date = new Date(trade.close_time);
            const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            const profit = Number(trade.net_profit || 0);
            const commission = Math.abs(Number(trade.commission || 0));
            const swap = Number(trade.swap || 0);
            
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = {
                    profit: 0,
                    loss: 0,
                    commission: 0,
                    swap: 0,
                    dividends: 0
                };
            }
            
            if (profit >= 0) {
                monthlyStats[monthKey].profit += profit;
            } else {
                monthlyStats[monthKey].loss += Math.abs(profit);
            }
            monthlyStats[monthKey].commission += commission;
            monthlyStats[monthKey].swap += swap;
        });
        
        return Object.entries(monthlyStats)
            .sort((a, b) => new Date(a[0]) - new Date(b[0]))
            .map(([month, stats]) => ({
                month,
                profit: Number(stats.profit.toFixed(2)),
                loss: Number(stats.loss.toFixed(2)),
                commission: Number(stats.commission.toFixed(2)),
                swap: Number(stats.swap.toFixed(2)),
                dividends: Number(stats.dividends.toFixed(2))
            }));
    };

    const winLossData = {
        wins: stats?.winningTrades || 0,
        losses: stats?.losingTrades || 0,
    };

    const pairPerformance = {};
    filteredTrades.forEach(trade => {
        if (trade.status === 'CLOSED' && trade.pair) {
            if (!pairPerformance[trade.pair]) {
                pairPerformance[trade.pair] = { trades: 0, profit: 0 };
            }
            pairPerformance[trade.pair].trades++;
            pairPerformance[trade.pair].profit += Number(trade.net_profit || 0);
        }
    });

    const sessionPerformance = {
        Asian: 0, London: 0, 'New York': 0, Sydney: 0
    };
    filteredTrades.forEach(trade => {
        if (trade.status === 'CLOSED' && trade.session) {
            sessionPerformance[trade.session] = (sessionPerformance[trade.session] || 0) + Number(trade.net_profit || 0);
        }
    });

    // Chart data
    const equityData = calculateEquityData();
    const riskRewardData = calculateRiskRewardData();
    const assetAllocation = calculateAssetAllocation();
    const cumulativePLData = calculateCumulativePL();
    const histogramData = calculatePerformanceHistogram();
    const monthlyPerformanceData = calculateMonthlyPerformance();

    // Custom Tooltip Component
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-bloomberg-bg-secondary border border-bloomberg-border rounded-lg p-3 shadow-xl">
                    <p className="text-bloomberg-text-primary text-sm font-bold mb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} className="text-xs" style={{ color: entry.color }}>
                            {entry.name}: <span className="font-bold">{entry.value}</span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="max-w-[1920px] mx-auto px-3 py-2 space-y-2">
            {/* Compact Header */}
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-bold text-bloomberg-text-primary terminal-text flex items-center space-x-2">
                    <span>Trading Dashboard</span>
                    {refreshing && <span className="text-[10px] text-bloomberg-accent animate-pulse">● Live Update</span>}
                    {isInitialLoad && <span className="text-[10px] text-bloomberg-warning">⟳ Syncing...</span>}
                </h1>
                <div className="flex items-center space-x-3 text-[10px]">
                    <div>
                        <span className="text-bloomberg-text-muted">Balance: </span>
                        <span className="text-bloomberg-accent terminal-text font-bold">${Number(accountInfo?.currentBalance || user?.balance || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-bloomberg-text-muted">MT5: {user?.accountNumber}</div>
                </div>
            </div>

            {/* High-Density Top Stats Ribbon - Carousel 4 Cards */}
            <div className="relative card-bloomberg rounded-lg p-2">
                <div className="grid grid-cols-4 gap-2">
                    {/* KPI Cards Array */}
                    {(() => {
                        const kpiCards = [
                            // Page 0
                            [
                                {
                                    label: 'Trades',
                                    value: stats?.totalTrades || 0,
                                    subtext: 'Total',
                                    color: 'text-bloomberg-accent'
                                },
                                {
                                    label: 'Win Rate',
                                    value: `${stats?.winRate || 0}%`,
                                    subtext: `${winLossData.wins}W / ${winLossData.losses}L`,
                                    color: 'text-bloomberg-accent'
                                },
                                {
                                    label: 'P/L',
                                    value: `$${Number(stats?.totalProfitLoss || 0).toFixed(2)}`,
                                    subtext: 'Net',
                                    color: stats?.totalProfitLoss >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Cumulative',
                                    value: `$${journalAnalytics.accumulativeReturnNet.toFixed(2)}`,
                                    subtext: `${journalAnalytics.accumulativeReturnPercent.toFixed(1)}%`,
                                    color: journalAnalytics.accumulativeReturnNet >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                }
                            ],
                            // Page 1
                            [
                                {
                                    label: 'Daily',
                                    value: `$${journalAnalytics.dailyReturn.toFixed(2)}`,
                                    subtext: 'Today',
                                    color: journalAnalytics.dailyReturn >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Weekly',
                                    value: `$${journalAnalytics.weeklyReturn.toFixed(2)}`,
                                    subtext: '7D',
                                    color: journalAnalytics.weeklyReturn >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Monthly',
                                    value: `$${journalAnalytics.monthlyReturn.toFixed(2)}`,
                                    subtext: '30D',
                                    color: journalAnalytics.monthlyReturn >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Balance',
                                    value: `$${Number(accountInfo?.currentBalance || user?.balance || 0).toFixed(2)}`,
                                    subtext: 'MT5 Account',
                                    color: 'text-bloomberg-accent'
                                }
                            ],
                            // Page 2
                            [
                                {
                                    label: 'Winners',
                                    value: `$${journalAnalytics.returnOnWinners.toFixed(2)}`,
                                    subtext: 'Total',
                                    color: 'text-bloomberg-success'
                                },
                                {
                                    label: 'Losers',
                                    value: `$${journalAnalytics.returnOnLosers.toFixed(2)}`,
                                    subtext: 'Total',
                                    color: 'text-bloomberg-danger'
                                },
                                {
                                    label: 'PF',
                                    value: journalAnalytics.profitFactor.toFixed(2),
                                    subtext: journalAnalytics.profitFactor >= 1 ? 'Good' : 'Bad',
                                    color: journalAnalytics.profitFactor >= 1 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'ROI',
                                    value: `${journalAnalytics.accumulativeReturnPercent.toFixed(2)}%`,
                                    subtext: 'Return',
                                    color: journalAnalytics.accumulativeReturnPercent >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                }
                            ],
                            // Page 3
                            [
                                {
                                    label: 'Long',
                                    value: `$${journalAnalytics.returnOnLong.toFixed(2)}`,
                                    subtext: 'Return',
                                    color: journalAnalytics.returnOnLong >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Short',
                                    value: `$${journalAnalytics.returnOnShort.toFixed(2)}`,
                                    subtext: 'Return',
                                    color: journalAnalytics.returnOnShort >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Best Trade',
                                    value: `$${journalAnalytics.biggestProfit.toFixed(2)}`,
                                    subtext: 'Profit',
                                    color: 'text-bloomberg-success'
                                },
                                {
                                    label: 'Worst Trade',
                                    value: `$${journalAnalytics.biggestLoss.toFixed(2)}`,
                                    subtext: 'Loss',
                                    color: 'text-bloomberg-danger'
                                }
                            ],
                            // Page 4
                            [
                                {
                                    label: 'P/L Ratio',
                                    value: `${journalAnalytics.profitLossRatio.toFixed(2)}:1`,
                                    subtext: 'Ratio',
                                    color: journalAnalytics.profitLossRatio >= 1 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Expectancy',
                                    value: `$${journalAnalytics.tradeExpectancy.toFixed(2)}`,
                                    subtext: 'Per Trade',
                                    color: journalAnalytics.tradeExpectancy >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                },
                                {
                                    label: 'Avg Win',
                                    value: `$${journalAnalytics.avgWinAmount.toFixed(2)}`,
                                    subtext: 'Average',
                                    color: 'text-bloomberg-success'
                                },
                                {
                                    label: 'Avg Loss',
                                    value: `$${journalAnalytics.avgLossAmount.toFixed(2)}`,
                                    subtext: 'Average',
                                    color: 'text-bloomberg-danger'
                                }
                            ]
                        ];

                        const currentPage = kpiCards[currentKpiPageIndex] || kpiCards[0];

                        return currentPage.map((card, idx) => (
                            <div key={idx} className="px-3 py-2 border-r border-bloomberg-border last:border-r-0">
                                <div className="text-[9px] text-bloomberg-text-muted uppercase font-semibold">{card.label}</div>
                                <div className={`text-xl font-bold terminal-text mt-0.5 ${card.color}`}>
                                    {card.value}
                                </div>
                                <div className="text-[8px] text-bloomberg-text-muted">{card.subtext}</div>
                            </div>
                        ));
                    })()}
                </div>

                {/* Navigation Arrows */}
                <button
                    onClick={() => setCurrentKpiPageIndex((currentKpiPageIndex - 1 + 5) % 5)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 p-1 
                             bg-bloomberg-bg-secondary rounded-full hover:bg-bloomberg-bg-tertiary 
                             transition-colors z-10 shadow-lg"
                    title="Previous KPI page"
                >
                    <ChevronLeft size={16} className="text-bloomberg-text-primary" />
                </button>
                <button
                    onClick={() => setCurrentKpiPageIndex((currentKpiPageIndex + 1) % 5)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 p-1 
                             bg-bloomberg-bg-secondary rounded-full hover:bg-bloomberg-bg-tertiary 
                             transition-colors z-10 shadow-lg"
                    title="Next KPI page"
                >
                    <ChevronRight size={16} className="text-bloomberg-text-primary" />
                </button>

                {/* Page Indicator */}
                <div className="flex justify-center mt-2 space-x-1">
                    {[0, 1, 2, 3, 4].map((page) => (
                        <button
                            key={page}
                            onClick={() => setCurrentKpiPageIndex(page)}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                currentKpiPageIndex === page 
                                    ? 'bg-bloomberg-accent' 
                                    : 'bg-bloomberg-border hover:bg-bloomberg-text-muted'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Compact Middle Section: Carousel Left + Calendar Right */}
            <div className="grid grid-cols-[45%_55%] gap-2">
                
                {/* LEFT COLUMN - Carousel Cards */}
                <div className="space-y-2">
                    
                    {/* Top Carousel Card - 4 Widgets */}
                    <div className="relative card-bloomberg rounded-lg p-3 h-[180px]">
                        {currentLeftCardIndex === 0 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <PieChart size={14} className="mr-1" />
                                    Win/Loss Ratio
                                </h3>
                                <div className="flex items-center justify-center space-x-6 py-4">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-bloomberg-success terminal-text">
                                            {winLossData.wins}
                                        </div>
                                        <div className="text-[10px] text-bloomberg-text-muted mt-1">Wins</div>
                                        <div className="mt-1 h-2 w-24 bg-bloomberg-success/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-bloomberg-success rounded-full"
                                                style={{
                                                    width: `${(winLossData.wins / (winLossData.wins + winLossData.losses || 1)) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-bloomberg-danger terminal-text">
                                            {winLossData.losses}
                                        </div>
                                        <div className="text-[10px] text-bloomberg-text-muted mt-1">Losses</div>
                                        <div className="mt-1 h-2 w-24 bg-bloomberg-danger/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-bloomberg-danger rounded-full"
                                                style={{
                                                    width: `${(winLossData.losses / (winLossData.wins + winLossData.losses || 1)) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {currentLeftCardIndex === 1 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <Calendar size={14} className="mr-1" />
                                    Session Performance
                                </h3>
                                <div className="space-y-1.5 py-2">
                                    {Object.entries(sessionPerformance).map(([session, profit]) => (
                                        <div key={session} className="flex items-center justify-between">
                                            <span className="text-[10px] text-bloomberg-text-secondary">{session}</span>
                                            <div className="flex items-center space-x-2">
                                                <div className="h-1.5 w-20 bg-bloomberg-bg-tertiary rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${profit >= 0 ? 'bg-bloomberg-success' : 'bg-bloomberg-danger'}`}
                                                        style={{
                                                            width: `${Math.min(Math.abs(profit) / (Math.max(Math.abs(stats?.totalProfitLoss), 1) || 1) * 100, 100)}%`
                                                        }}
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-bold terminal-text min-w-[50px] text-right ${
                                                    profit >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                                }`}>
                                                    ${profit.toFixed(0)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {currentLeftCardIndex === 2 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2">
                                    Quick Statistics
                                </h3>
                                <div className="grid grid-cols-2 gap-3 py-3">
                                    <div>
                                        <div className="text-[9px] text-bloomberg-text-muted">Total Trades</div>
                                        <div className="text-xl font-bold text-bloomberg-accent terminal-text">
                                            {stats?.totalTrades || 0}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-bloomberg-text-muted">Win Rate</div>
                                        <div className="text-xl font-bold text-bloomberg-accent terminal-text">
                                            {stats?.winRate || 0}%
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-bloomberg-text-muted">Profit Factor</div>
                                        <div className="text-xl font-bold text-bloomberg-accent terminal-text">
                                            {Number(stats?.profitFactor || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] text-bloomberg-text-muted">Total P/L</div>
                                        <div className={`text-xl font-bold terminal-text ${
                                            stats?.totalProfitLoss >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                        }`}>
                                            ${Number(stats?.totalProfitLoss || 0).toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {currentLeftCardIndex === 3 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <PieChart size={14} className="mr-1" />
                                    Asset Allocation
                                </h3>
                                <div className="space-y-1 py-2">
                                    {assetAllocation.assets.slice(0, 3).map((asset, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span className="text-[10px] text-bloomberg-text-secondary">{asset.name}</span>
                                            <span className="text-[10px] text-bloomberg-accent terminal-text font-bold">{asset.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-bloomberg-border">
                                    {assetAllocation.manualEA.map((item, idx) => (
                                        <div key={idx} className="flex justify-between mb-1">
                                            <span className="text-[10px] text-bloomberg-text-secondary">{item.name}</span>
                                            <span className="text-[10px] text-bloomberg-accent terminal-text font-bold">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Navigation Arrows */}
                        <button
                            onClick={() => setCurrentLeftCardIndex((currentLeftCardIndex - 1 + 4) % 4)}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 p-1 
                                     bg-bloomberg-bg-secondary rounded-full hover:bg-bloomberg-bg-tertiary 
                                     transition-colors z-10"
                        >
                            <ChevronLeft size={16} className="text-bloomberg-text-primary" />
                        </button>
                        <button
                            onClick={() => setCurrentLeftCardIndex((currentLeftCardIndex + 1) % 4)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 p-1 
                                     bg-bloomberg-bg-secondary rounded-full hover:bg-bloomberg-bg-tertiary 
                                     transition-colors z-10"
                        >
                            <ChevronRight size={16} className="text-bloomberg-text-primary" />
                        </button>
                    </div>

                    {/* Bottom Carousel Card - Charts */}
                    <div className="relative card-bloomberg rounded-lg p-3 h-[320px]">
                        {currentBottomCardIndex === 0 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <PieChart size={14} className="mr-1" />
                                    Asset Analysis
                                </h3>
                                <div className="grid grid-cols-3 gap-3 h-[270px]">
                                    {/* Column 1: Win/Loss Distribution + Top Symbols */}
                                    <div className="space-y-3">
                                        {/* Win/Loss Donut */}
                                        <div className="bg-bloomberg-bg-tertiary/30 rounded p-2">
                                            <div className="text-[8px] text-bloomberg-text-muted font-bold mb-2">สัดส่วนชนะทั้งหมด</div>
                                            <div className="flex items-center justify-center">
                                                <div className="relative w-24 h-24">
                                                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#2a3038" strokeWidth="12"/>
                                                        <circle 
                                                            cx="50" cy="50" r="40" 
                                                            fill="none" 
                                                            stroke="#10b981" 
                                                            strokeWidth="12"
                                                            strokeDasharray={`${(journalAnalytics.winRate || 0) * 2.51} 251`}
                                                        />
                                                        <circle 
                                                            cx="50" cy="50" r="40" 
                                                            fill="none" 
                                                            stroke="#ef4444" 
                                                            strokeWidth="12"
                                                            strokeDasharray={`${((100 - (journalAnalytics.winRate || 0))) * 2.51} 251`}
                                                            strokeDashoffset={`-${(journalAnalytics.winRate || 0) * 2.51}`}
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <div className="text-xl font-bold text-bloomberg-text-primary terminal-text">
                                                            {journalAnalytics.totalTrades || 0}
                                                        </div>
                                                        <div className="text-[7px] text-bloomberg-text-muted">สัดส่วนชนะทั้งหมด</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 mt-2 text-[8px]">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-bloomberg-success"></div>
                                                    <span className="text-bloomberg-text-muted">ชนะ</span>
                                                    <span className="text-bloomberg-text-primary font-bold ml-auto">{journalAnalytics.winningTrades || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-bloomberg-danger"></div>
                                                    <span className="text-bloomberg-text-muted">แพ้</span>
                                                    <span className="text-bloomberg-text-primary font-bold ml-auto">{journalAnalytics.losingTrades || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top Symbols List */}
                                        <div className="bg-bloomberg-bg-tertiary/30 rounded p-2">
                                            <div className="text-[8px] text-bloomberg-text-muted font-bold mb-1">TOP SYMBOLS</div>
                                            <div className="space-y-1">
                                                {assetAllocation.symbols.slice(0, 6).map((symbol, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-[9px]">
                                                        <span className="text-bloomberg-accent font-bold">{symbol.name}</span>
                                                        <span className="text-bloomberg-text-muted">{symbol.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Asset Allocation + Manual/EA */}
                                    <div className="space-y-3">
                                        {/* Asset Type Donut */}
                                        <div className="bg-bloomberg-bg-tertiary/30 rounded p-2">
                                            <div className="text-[8px] text-bloomberg-text-muted font-bold mb-2">ASSET TYPE</div>
                                            <div className="flex items-center justify-center">
                                                <div className="relative w-24 h-24">
                                                    {(() => {
                                                        const total = assetAllocation.assets.reduce((sum, a) => sum + a.value, 0);
                                                        const colors = ['#3b82f6', '#ef4444', '#6b7280'];
                                                        let offset = 0;
                                                        return (
                                                            <>
                                                                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                                                    <circle cx="50" cy="50" r="40" fill="none" stroke="#2a3038" strokeWidth="12"/>
                                                                    {assetAllocation.assets.map((asset, idx) => {
                                                                        const percent = total > 0 ? (asset.value / total) * 100 : 0;
                                                                        const dashLength = percent * 2.51;
                                                                        const result = (
                                                                            <circle 
                                                                                key={idx}
                                                                                cx="50" cy="50" r="40" 
                                                                                fill="none" 
                                                                                stroke={colors[idx] || '#6b7280'} 
                                                                                strokeWidth="12"
                                                                                strokeDasharray={`${dashLength} 251`}
                                                                                strokeDashoffset={`-${offset}`}
                                                                            />
                                                                        );
                                                                        offset += dashLength;
                                                                        return result;
                                                                    })}
                                                                </svg>
                                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                    <div className="text-xl font-bold text-bloomberg-text-primary terminal-text">
                                                                        {assetAllocation.assets[0]?.value || 0}
                                                                    </div>
                                                                    <div className="text-[7px] text-bloomberg-text-muted">{assetAllocation.assets[0]?.name || 'N/A'}</div>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="space-y-0.5 mt-2 text-[8px]">
                                                {assetAllocation.assets.map((asset, idx) => {
                                                    const colors = ['#3b82f6', '#ef4444', '#6b7280'];
                                                    const total = assetAllocation.assets.reduce((sum, a) => sum + a.value, 0);
                                                    const percent = total > 0 ? ((asset.value / total) * 100).toFixed(1) : '0.0';
                                                    return (
                                                        <div key={idx} className="flex items-center gap-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx] }}></div>
                                                            <span className="text-bloomberg-text-muted">{asset.name}</span>
                                                            <span className="text-bloomberg-text-primary font-bold ml-auto">{asset.value} ({percent}%)</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 3: Horizontal Bar Charts */}
                                    <div className="space-y-2 overflow-y-auto max-h-[270px]">
                                        {/* Profit Factor by Symbols */}
                                        <div className="bg-bloomberg-bg-tertiary/30 rounded p-2">
                                            <div className="text-[8px] text-bloomberg-text-muted font-bold mb-2">Profit Factor by Symbols</div>
                                            <div className="space-y-1.5">
                                                {assetAllocation.profitBySymbol.map((item, idx) => {
                                                    const maxProfit = Math.max(...assetAllocation.profitBySymbol.map(p => Math.abs(p.value)));
                                                    const width = maxProfit > 0 ? (Math.abs(item.value) / maxProfit) * 100 : 0;
                                                    const isPositive = item.value >= 0;
                                                    return (
                                                        <div key={idx}>
                                                            <div className="flex justify-between items-center text-[8px] mb-0.5">
                                                                <span className="text-bloomberg-text-secondary">{item.name}</span>
                                                                <span className={`font-bold terminal-text ${isPositive ? 'text-bloomberg-success' : 'text-bloomberg-danger'}`}>
                                                                    {item.value.toFixed(2)}
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 bg-bloomberg-bg-secondary rounded overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${isPositive ? 'bg-bloomberg-success' : 'bg-bloomberg-danger'}`}
                                                                    style={{ width: `${width}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Netto Profit by Symbols */}
                                        <div className="bg-bloomberg-bg-tertiary/30 rounded p-2">
                                            <div className="text-[8px] text-bloomberg-text-muted font-bold mb-2">Netto Profit by Symbols</div>
                                            <div className="space-y-1.5">
                                                {assetAllocation.profitBySymbol.slice(0, 7).map((item, idx) => {
                                                    const maxValue = Math.max(...assetAllocation.profitBySymbol.map(p => Math.abs(p.value)), 1);
                                                    const width = (Math.abs(item.value) / maxValue) * 100;
                                                    const isPositive = item.value >= 0;
                                                    return (
                                                        <div key={idx}>
                                                            <div className="flex justify-between items-center text-[8px] mb-0.5">
                                                                <span className="text-bloomberg-text-secondary">{item.name}</span>
                                                                <span className={`font-bold terminal-text ${isPositive ? 'text-bloomberg-success' : 'text-bloomberg-danger'}`}>
                                                                    {item.value >= 0 ? '+' : ''}{item.value.toFixed(2)}
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 bg-bloomberg-bg-secondary rounded overflow-hidden">
                                                                <div 
                                                                    className={`h-full transition-all ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${width}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {currentBottomCardIndex === 1 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <TrendingUp size={14} className="mr-1" />
                                    Equity Curve
                                </h3>
                                {equityData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={270}>
                                        <LineChart data={equityData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3038" />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                            />
                                            <YAxis 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                            />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '9px' }} />
                                            <Line 
                                                type="monotone" 
                                                dataKey="balance" 
                                                stroke="#3b82f6" 
                                                strokeWidth={1.5}
                                                name="Balance"
                                                dot={{ r: 2 }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="equity" 
                                                stroke="#a855f7" 
                                                strokeWidth={1.5}
                                                name="Equity"
                                                dot={{ r: 2 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[270px] text-bloomberg-text-muted text-xs">
                                        No trades
                                    </div>
                                )}
                            </>
                        )}

                        {currentBottomCardIndex === 2 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <Target size={14} className="mr-1" />
                                    Win Rate vs Risk/Reward
                                </h3>
                                {riskRewardData.scatter && riskRewardData.scatter.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={270}>
                                        <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3038" />
                                            <XAxis 
                                                type="number" 
                                                dataKey="rr" 
                                                name="R:R Ratio" 
                                                stroke="#6b7280"
                                                domain={[0, 10]}
                                                label={{ value: 'Risk/Reward Ratio', position: 'insideBottom', offset: -10, fill: '#6b7280', fontSize: 10 }}
                                                style={{ fontSize: '9px' }}
                                            />
                                            <YAxis 
                                                type="number" 
                                                dataKey="winRate" 
                                                name="Win Rate" 
                                                stroke="#6b7280"
                                                domain={[0, 100]}
                                                label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                                                style={{ fontSize: '9px' }}
                                            />
                                            <RechartsTooltip 
                                                content={({ payload }) => {
                                                    if (payload && payload[0]) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-bloomberg-bg-secondary border border-bloomberg-border rounded p-2 shadow-xl">
                                                                <p className="text-[10px] text-bloomberg-text-primary font-bold">{data.pair}</p>
                                                                <p className="text-[9px] text-bloomberg-text-muted">R:R: {data.rr}:1</p>
                                                                <p className={`text-[9px] font-bold ${data.isWin ? 'text-bloomberg-success' : 'text-bloomberg-danger'}`}>
                                                                    ${data.profit.toFixed(2)}
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Scatter name="Trades" data={riskRewardData.scatter}>
                                                {riskRewardData.scatter.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={entry.isWin ? '#10b981' : '#ef4444'}
                                                        fillOpacity={0.5}
                                                    />
                                                ))}
                                            </Scatter>
                                            {/* Trend Line from actual data */}
                                            {riskRewardData.trendLine && riskRewardData.trendLine.length > 1 && (
                                                <Scatter 
                                                    name="Win Rate Trend" 
                                                    data={riskRewardData.trendLine}
                                                    line={{ stroke: '#F59E0B', strokeWidth: 3 }}
                                                    lineType="monotone"
                                                    shape={() => null}
                                                />
                                            )}
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[270px] text-bloomberg-text-muted text-xs">
                                        No trades
                                    </div>
                                )}
                            </>
                        )}

                        {currentBottomCardIndex === 3 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <Activity size={14} className="mr-1" />
                                    Cumulative P/L
                                </h3>
                                {cumulativePLData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={270}>
                                        <ComposedChart data={cumulativePLData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3038" />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                            />
                                            <YAxis 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                            />
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Area 
                                                type="monotone" 
                                                dataKey="pl" 
                                                fill="#14b8a6" 
                                                stroke="#14b8a6" 
                                                fillOpacity={0.3}
                                                name="Cumulative P/L"
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="pl" 
                                                stroke="#14b8a6" 
                                                strokeWidth={2}
                                                dot={{ r: 2 }}
                                            />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[270px] text-bloomberg-text-muted text-xs">
                                        No trades
                                    </div>
                                )}
                            </>
                        )}

                        {currentBottomCardIndex === 4 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <BarChart3 size={14} className="mr-1" />
                                    Daily Performance Breakdown
                                </h3>
                                {histogramData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={270}>
                                        <BarChart data={histogramData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3038" />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                            />
                                            <YAxis 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                            />
                                            <RechartsTooltip 
                                                content={({ payload }) => {
                                                    if (payload && payload.length > 0) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-bloomberg-bg-secondary border border-bloomberg-border rounded p-2 shadow-xl">
                                                                <p className="text-[10px] text-bloomberg-text-primary font-bold mb-1">{data.date}</p>
                                                                <div className="space-y-0.5 text-[9px]">
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-success">Profit:</span>
                                                                        <span className="font-bold text-bloomberg-success">${data.profit.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-danger">Loss:</span>
                                                                        <span className="font-bold text-bloomberg-danger">${data.loss.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-text-muted">Commission:</span>
                                                                        <span className="font-bold text-bloomberg-text-primary">${data.commission.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-text-muted">Swaps:</span>
                                                                        <span className="font-bold text-bloomberg-text-primary">${data.swap.toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '9px' }} />
                                            <Bar dataKey="profit" stackId="a" fill="#10b981" name="Profit" />
                                            <Bar dataKey="loss" stackId="a" fill="#ef4444" name="Loss" />
                                            <Bar dataKey="dividends" stackId="a" fill="#3b82f6" name="Dividends" />
                                            <Bar dataKey="swap" stackId="a" fill="#f59e0b" name="Swaps" />
                                            <Bar dataKey="commission" stackId="a" fill="#6b7280" name="Commissions" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[270px] text-bloomberg-text-muted text-xs">
                                        No trades
                                    </div>
                                )}
                            </>
                        )}

                        {currentBottomCardIndex === 5 && (
                            <>
                                <h3 className="text-sm font-bold text-bloomberg-text-primary mb-2 flex items-center">
                                    <BarChart3 size={14} className="mr-1" />
                                    Monthly Performance Breakdown
                                </h3>
                                {monthlyPerformanceData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={270}>
                                        <BarChart data={monthlyPerformanceData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3038" />
                                            <XAxis 
                                                dataKey="month" 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                            />
                                            <YAxis 
                                                stroke="#6b7280" 
                                                style={{ fontSize: '9px' }}
                                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                            />
                                            <RechartsTooltip 
                                                content={({ payload }) => {
                                                    if (payload && payload.length > 0) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-bloomberg-bg-secondary border border-bloomberg-border rounded p-2 shadow-xl">
                                                                <p className="text-[10px] text-bloomberg-text-primary font-bold mb-1">{data.month}</p>
                                                                <div className="space-y-0.5 text-[9px]">
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-success">Profit:</span>
                                                                        <span className="font-bold text-bloomberg-success">${data.profit.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-danger">Loss:</span>
                                                                        <span className="font-bold text-bloomberg-danger">${data.loss.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-text-muted">Commission:</span>
                                                                        <span className="font-bold text-bloomberg-text-primary">${data.commission.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between gap-2">
                                                                        <span className="text-bloomberg-text-muted">Swaps:</span>
                                                                        <span className="font-bold text-bloomberg-text-primary">${data.swap.toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '9px' }} />
                                            <Bar dataKey="profit" stackId="a" fill="#10b981" name="Profit" />
                                            <Bar dataKey="loss" stackId="a" fill="#ef4444" name="Loss" />
                                            <Bar dataKey="dividends" stackId="a" fill="#3b82f6" name="Dividends" />
                                            <Bar dataKey="swap" stackId="a" fill="#f59e0b" name="Swaps" />
                                            <Bar dataKey="commission" stackId="a" fill="#6b7280" name="Commissions" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[270px] text-bloomberg-text-muted text-xs">
                                        No trades
                                    </div>
                                )}
                            </>
                        )}

                        {/* Navigation Arrows */}
                        <button
                            onClick={() => setCurrentBottomCardIndex((currentBottomCardIndex - 1 + 6) % 6)}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 p-1 
                                     bg-bloomberg-bg-secondary rounded-full hover:bg-bloomberg-bg-tertiary 
                                     transition-colors z-10"
                        >
                            <ChevronLeft size={16} className="text-bloomberg-text-primary" />
                        </button>
                        <button
                            onClick={() => setCurrentBottomCardIndex((currentBottomCardIndex + 1) % 6)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 p-1 
                                     bg-bloomberg-bg-secondary rounded-full hover:bg-bloomberg-bg-tertiary 
                                     transition-colors z-10"
                        >
                            <ChevronRight size={16} className="text-bloomberg-text-primary" />
                        </button>
                    </div>

                </div>

                {/* RIGHT COLUMN - Compact Trading Calendar */}
                <div className="card-bloomberg rounded-lg p-3 h-[504px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-bloomberg-text-primary flex items-center">
                            <Calendar size={14} className="mr-1" />
                            Trading Calendar
                        </h3>
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => {
                                    const newDate = new Date(calendarDate);
                                    newDate.setMonth(newDate.getMonth() - 1);
                                    setCalendarDate(newDate);
                                }}
                                className="p-0.5 hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                            >
                                <ChevronLeft size={12} className="text-bloomberg-text-primary" />
                            </button>
                            <button
                                onClick={() => setCalendarDate(new Date())}
                                className="px-2 py-0.5 text-[8px] bg-bloomberg-accent/20 hover:bg-bloomberg-accent/30 
                                         text-bloomberg-accent rounded transition-colors terminal-text"
                            >
                                Today
                            </button>
                            <span className="text-[9px] text-bloomberg-text-secondary terminal-text min-w-[60px] text-center">
                                {calendarDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                            <button
                                onClick={() => {
                                    const newDate = new Date(calendarDate);
                                    newDate.setMonth(newDate.getMonth() + 1);
                                    setCalendarDate(newDate);
                                }}
                                className="p-0.5 hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                            >
                                <ChevronRight size={12} className="text-bloomberg-text-primary" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Monthly Summary */}
                    {(() => {
                        const year = calendarDate.getFullYear();
                        const month = calendarDate.getMonth();
                        const monthlyTrades = filteredTrades.filter(t => {
                            const tradeDate = new Date(t.trade_date);
                            return t.status === 'CLOSED' && 
                                   tradeDate.getMonth() === month && 
                                   tradeDate.getFullYear() === year;
                        });
                        
                        const monthlyPL = monthlyTrades.reduce((sum, t) => sum + Number(t.net_profit || 0), 0);
                        const monthlyWins = monthlyTrades.filter(t => Number(t.net_profit || 0) > 0).length;
                        const monthlyWinRate = monthlyTrades.length > 0 
                            ? ((monthlyWins / monthlyTrades.length) * 100).toFixed(0)
                            : 0;
                        
                        return (
                            <div className="grid grid-cols-3 gap-1 mb-2 pb-2 border-b border-bloomberg-border">
                                <div className="text-center">
                                    <div className="text-[7px] text-bloomberg-text-muted">P/L</div>
                                    <div className={`text-[10px] font-bold terminal-text ${
                                        monthlyPL >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                    }`}>
                                        ${monthlyPL.toFixed(0)}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[7px] text-bloomberg-text-muted">Trades</div>
                                    <div className="text-[10px] font-bold text-bloomberg-accent terminal-text">
                                        {monthlyTrades.length}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[7px] text-bloomberg-text-muted">Win%</div>
                                    <div className="text-[10px] font-bold text-bloomberg-accent terminal-text">
                                        {monthlyWinRate}%
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                    
                    {/* Calendar Grid */}
                    <div className="space-y-1">
                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                <div key={i} className="text-center text-[7px] text-bloomberg-text-muted font-bold">
                                    {day}
                                </div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-0.5">
                            {(() => {
                                const year = calendarDate.getFullYear();
                                const month = calendarDate.getMonth();
                                const firstDay = new Date(year, month, 1).getDay();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const days = [];
                                
                                const dailyStats = {};
                                filteredTrades.filter(t => t.status === 'CLOSED').forEach(trade => {
                                    const tradeDate = new Date(trade.trade_date);
                                    if (tradeDate.getMonth() === month && tradeDate.getFullYear() === year) {
                                        const day = tradeDate.getDate();
                                        if (!dailyStats[day]) {
                                            dailyStats[day] = { trades: 0, pl: 0 };
                                        }
                                        dailyStats[day].trades++;
                                        dailyStats[day].pl += Number(trade.net_profit || 0);
                                    }
                                });
                                
                                for (let i = 0; i < firstDay; i++) {
                                    days.push(<div key={`empty-${i}`} className="h-[68px]" />);
                                }
                                
                                for (let day = 1; day <= daysInMonth; day++) {
                                    const stats = dailyStats[day];
                                    const hasData = !!stats;
                                    const profit = stats?.pl || 0;
                                    
                                    days.push(
                                        <div
                                            key={day}
                                            className={`h-[68px] rounded text-[10px] flex flex-col items-center justify-center
                                                      transition-all cursor-pointer ${
                                                hasData
                                                    ? profit >= 0
                                                        ? 'bg-bloomberg-success/20 hover:bg-bloomberg-success/30 border border-bloomberg-success/40'
                                                        : 'bg-bloomberg-danger/20 hover:bg-bloomberg-danger/30 border border-bloomberg-danger/40'
                                                    : 'bg-bloomberg-bg-tertiary/30 hover:bg-bloomberg-bg-tertiary/50'
                                            }`}
                                            title={hasData ? `${stats.trades} trades, $${profit.toFixed(2)}` : ''}
                                        >
                                            <span className="text-bloomberg-text-primary font-medium leading-none text-[9px]">{day}</span>
                                            {hasData && (
                                                <span className={`text-[7px] font-bold leading-none mt-1 ${
                                                    profit >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                                }`}>
                                                    ${Math.abs(profit) < 100 ? profit.toFixed(0) : (profit/1000).toFixed(1)+'k'}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }
                                
                                return days;
                            })()}
                        </div>
                    </div>

                    {/* Weekly Summary */}
                    <div className="mt-3 pt-3 border-t border-bloomberg-border">
                        <div className="text-[8px] text-bloomberg-text-muted font-bold mb-2">WEEKLY P/L</div>
                        <div className="grid grid-cols-4 gap-1">
                            {(() => {
                                const year = calendarDate.getFullYear();
                                const month = calendarDate.getMonth();
                                
                                const weeklyStats = { 1: { trades: 0, pl: 0 }, 2: { trades: 0, pl: 0 }, 3: { trades: 0, pl: 0 }, 4: { trades: 0, pl: 0 } };
                                
                                filteredTrades.filter(t => t.status === 'CLOSED').forEach(trade => {
                                    const tradeDate = new Date(trade.trade_date);
                                    if (tradeDate.getMonth() === month && tradeDate.getFullYear() === year) {
                                        const day = tradeDate.getDate();
                                        const weekNum = Math.ceil(day / 7); // วันที่ 1-7 = สัปดาห์ที่ 1, 8-14 = สัปดาห์ที่ 2, etc.
                                        
                                        if (weekNum <= 4) {
                                            weeklyStats[weekNum].trades++;
                                            weeklyStats[weekNum].pl += Number(trade.net_profit || 0);
                                        }
                                    }
                                });
                                
                                const weeks = [];
                                for (let w = 1; w <= 4; w++) {
                                    const stats = weeklyStats[w];
                                    weeks.push(
                                        <div
                                            key={w}
                                            className="bg-bloomberg-bg-tertiary/30 rounded p-1.5 text-center"
                                        >
                                            <div className="text-[8px] text-bloomberg-text-muted font-bold">W{w}</div>
                                            <div className={`text-[11px] font-bold terminal-text ${
                                                stats.pl >= 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                            }`}>
                                                ${stats.pl.toFixed(0)}
                                            </div>
                                            <div className="text-[7px] text-bloomberg-text-muted">
                                                {stats.trades}T
                                            </div>
                                        </div>
                                    );
                                }
                                
                                return weeks;
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Maximized Trading Journal Section */}
            <div className="card-bloomberg rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-bloomberg-text-primary">
                        Trading Journal
                    </h2>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setIsJournalFullscreen(true)}
                            className="p-1 hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                            title="Fullscreen view"
                        >
                            <Maximize2 size={14} className="text-bloomberg-accent" />
                        </button>
                        <button
                            onClick={() => setShowColumnModal(true)}
                            className="p-1 hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                            title="Add custom column"
                        >
                            <Plus size={14} className="text-bloomberg-accent" />
                        </button>
                        <Filter size={12} className="text-bloomberg-text-muted" />
                        <select
                            value={filter.status}
                            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                            className="input-bloomberg px-2 py-1 rounded text-[9px]"
                        >
                            <option value="all">All Status</option>
                            <option value="OPEN">Open</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                        <select
                            value={filter.session}
                            onChange={(e) => setFilter({ ...filter, session: e.target.value })}
                            className="input-bloomberg px-2 py-1 rounded text-[9px]"
                        >
                            <option value="all">All Sessions</option>
                            <option value="Asian">Asian</option>
                            <option value="London">London</option>
                            <option value="New York">New York</option>
                            <option value="Sydney">Sydney</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Filter pair..."
                            value={filter.pair}
                            onChange={(e) => setFilter({ ...filter, pair: e.target.value })}
                            className="input-bloomberg px-2 py-1 rounded text-[9px] w-20"
                        />
                    </div>
                </div>

                {filteredTrades.length === 0 ? (
                    <div className="text-center py-8">
                        <AlertCircle size={32} className="mx-auto text-bloomberg-text-muted mb-2" />
                        <p className="text-bloomberg-text-secondary text-xs">No trades found</p>
                        <p className="text-[9px] text-bloomberg-text-muted mt-1">
                            Start trading or sync your MT5 account
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="table-bloomberg w-full text-[9px]">
                                <thead className="sticky top-0 bg-bloomberg-bg-secondary z-10">
                                    <tr>
                                        <th className="py-1 px-2">Pair</th>
                                        <th className="py-1 px-2">Dir</th>
                                        <th className="py-1 px-2">Vol</th>
                                        <th className="py-1 px-2">Entry</th>
                                        <th className="py-1 px-2">Exit</th>
                                        <th className="py-1 px-2">P/L</th>
                                        <th className="py-1 px-2">Session</th>
                                        <th className="py-1 px-2">Status</th>
                                        <th className="py-1 px-2">Date</th>
                                        {customColumns.map(col => (
                                            <th key={col.id} className="py-1 px-2 group relative">
                                                {col.name}
                                                <button
                                                    onClick={() => removeCustomColumn(col.id)}
                                                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remove column"
                                                >
                                                    <X size={10} className="text-bloomberg-danger inline" />
                                                </button>
                                            </th>
                                        ))}
                                        <th className="py-1 px-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTrades
                                        .slice((currentPage - 1) * tradesPerPage, currentPage * tradesPerPage)
                                        .map((trade) => (
                                        <tr key={trade.id} className="hover:bg-bloomberg-bg-tertiary/50">
                                            <td className="font-medium terminal-text py-1 px-2">{trade.pair}</td>
                                            <td className="py-1 px-2">
                                                <span className={`px-1 py-0.5 rounded text-[7px] font-semibold ${trade.direction === 'LONG'
                                                        ? 'bg-bloomberg-success/20 text-bloomberg-success'
                                                        : 'bg-bloomberg-danger/20 text-bloomberg-danger'
                                                    }`}>
                                                    {trade.direction === 'LONG' ? 'L' : 'S'}
                                                </span>
                                            </td>
                                            <td className="terminal-text py-1 px-2">{trade.volume}</td>
                                            <td className="terminal-text py-1 px-2">{Number(trade.entry_price).toFixed(5)}</td>
                                            <td className="terminal-text py-1 px-2">
                                                {trade.exit_price ? Number(trade.exit_price).toFixed(5) : '-'}
                                            </td>
                                            <td className={`font-bold terminal-text py-1 px-2 ${Number(trade.net_profit || 0) > 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                                }`}>
                                                {trade.status === 'CLOSED' ? `$${Number(trade.net_profit || 0).toFixed(2)}` : '-'}
                                            </td>
                                            <td className="text-[8px] text-bloomberg-text-muted py-1 px-2">{trade.session}</td>
                                            <td className="py-1 px-2">
                                                <span className={`px-1 py-0.5 rounded text-[7px] ${trade.status === 'OPEN'
                                                        ? 'bg-bloomberg-accent/20 text-bloomberg-accent'
                                                        : 'bg-bloomberg-text-muted/20 text-bloomberg-text-muted'
                                                    }`}>
                                                    {trade.status === 'OPEN' ? 'O' : 'C'}
                                                </span>
                                            </td>
                                            <td className="text-[8px] text-bloomberg-text-muted py-1 px-2">
                                                {new Date(trade.status === 'OPEN' ? trade.open_time : trade.close_time).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                                            </td>
                                            {customColumns.map(col => (
                                                <td key={col.id} className="py-1 px-2">
                                                    {renderCustomCell(trade, col)}
                                                </td>
                                            ))}
                                            <td className="py-1 px-2">
                                                <button
                                                    onClick={() => handleDeleteTrade(trade.id)}
                                                    className="p-0.5 hover:bg-bloomberg-danger/20 rounded transition-colors"
                                                    title="Delete trade"
                                                >
                                                    <Trash2 size={10} className="text-bloomberg-danger" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filteredTrades.length > tradesPerPage && (
                            <div className="flex items-center justify-center space-x-2 mt-3">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 bg-bloomberg-bg-secondary hover:bg-bloomberg-bg-tertiary 
                                             disabled:opacity-30 disabled:cursor-not-allowed rounded text-[10px]
                                             text-bloomberg-text-primary transition-colors"
                                >
                                    <ChevronLeft size={12} />
                                </button>
                                
                                {(() => {
                                    const totalPages = Math.ceil(filteredTrades.length / tradesPerPage);
                                    const pages = [];
                                    
                                    if (totalPages <= 7) {
                                        for (let i = 1; i <= totalPages; i++) {
                                            pages.push(i);
                                        }
                                    } else {
                                        if (currentPage <= 4) {
                                            pages.push(1, 2, 3, 4, 5, '...', totalPages);
                                        } else if (currentPage >= totalPages - 3) {
                                            pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                                        } else {
                                            pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                                        }
                                    }
                                    
                                    return pages.map((page, idx) => (
                                        page === '...' ? (
                                            <span key={`ellipsis-${idx}`} className="px-2 text-bloomberg-text-muted">...</span>
                                        ) : (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`px-2 py-1 rounded text-[10px] transition-colors ${
                                                    currentPage === page
                                                        ? 'bg-bloomberg-accent text-bloomberg-bg-primary font-bold'
                                                        : 'bg-bloomberg-bg-secondary hover:bg-bloomberg-bg-tertiary text-bloomberg-text-primary'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    ));
                                })()}
                                
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredTrades.length / tradesPerPage), prev + 1))}
                                    disabled={currentPage === Math.ceil(filteredTrades.length / tradesPerPage)}
                                    className="px-2 py-1 bg-bloomberg-bg-secondary hover:bg-bloomberg-bg-tertiary 
                                             disabled:opacity-30 disabled:cursor-not-allowed rounded text-[10px]
                                             text-bloomberg-text-primary transition-colors"
                                >
                                    <ChevronRight size={12} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Fullscreen Trading Journal */}
            {isJournalFullscreen && (
                <div className="fixed inset-0 bg-bloomberg-bg-primary z-50 overflow-auto">
                    <div className="min-h-screen p-6">
                        <div className="max-w-[1920px] mx-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold text-bloomberg-text-primary">
                                    Trading Journal
                                </h2>
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => setShowColumnModal(true)}
                                        className="p-2 hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                                        title="Add custom column"
                                    >
                                        <Plus size={16} className="text-bloomberg-accent" />
                                    </button>
                                    <button
                                        onClick={() => setIsJournalFullscreen(false)}
                                        className="p-2 hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                                        title="Exit fullscreen"
                                    >
                                        <Minimize2 size={16} className="text-bloomberg-accent" />
                                    </button>
                                </div>
                            </div>

                            <div className="card-bloomberg rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                        <Filter size={14} className="text-bloomberg-text-muted" />
                                        <select
                                            value={filter.status}
                                            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                                            className="input-bloomberg px-2 py-1.5 rounded text-xs"
                                        >
                                            <option value="all">All Status</option>
                                            <option value="OPEN">Open</option>
                                            <option value="CLOSED">Closed</option>
                                        </select>
                                        <select
                                            value={filter.session}
                                            onChange={(e) => setFilter({ ...filter, session: e.target.value })}
                                            className="input-bloomberg px-2 py-1.5 rounded text-xs"
                                        >
                                            <option value="all">All Sessions</option>
                                            <option value="Asian">Asian</option>
                                            <option value="London">London</option>
                                            <option value="New York">New York</option>
                                            <option value="Sydney">Sydney</option>
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Filter pair..."
                                            value={filter.pair}
                                            onChange={(e) => setFilter({ ...filter, pair: e.target.value })}
                                            className="input-bloomberg px-2 py-1.5 rounded text-xs w-32"
                                        />
                                    </div>
                                    <div className="text-xs text-bloomberg-text-muted">
                                        {filteredTrades.length} trades
                                    </div>
                                </div>

                                {filteredTrades.length === 0 ? (
                                    <div className="text-center py-16">
                                        <AlertCircle size={48} className="mx-auto text-bloomberg-text-muted mb-3" />
                                        <p className="text-bloomberg-text-secondary text-sm">No trades found</p>
                                        <p className="text-xs text-bloomberg-text-muted mt-2">
                                            Start trading or sync your MT5 account
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="table-bloomberg w-full text-xs">
                                                <thead className="sticky top-0 bg-bloomberg-bg-secondary z-10">
                                                    <tr>
                                                        <th className="py-2 px-3">Pair</th>
                                                        <th className="py-2 px-3">Direction</th>
                                                        <th className="py-2 px-3">Volume</th>
                                                        <th className="py-2 px-3">Entry</th>
                                                        <th className="py-2 px-3">Exit</th>
                                                        <th className="py-2 px-3">P/L</th>
                                                        <th className="py-2 px-3">Session</th>
                                                        <th className="py-2 px-3">Status</th>
                                                        <th className="py-2 px-3">Date</th>
                                                        {customColumns.map(col => (
                                                            <th key={col.id} className="py-2 px-3 group relative">
                                                                {col.name}
                                                                <button
                                                                    onClick={() => removeCustomColumn(col.id)}
                                                                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Remove column"
                                                                >
                                                                    <X size={12} className="text-bloomberg-danger inline" />
                                                                </button>
                                                            </th>
                                                        ))}
                                                        <th className="py-2 px-3">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredTrades
                                                        .slice((currentFullscreenPage - 1) * tradesPerPage, currentFullscreenPage * tradesPerPage)
                                                        .map((trade) => (
                                                        <tr key={trade.id} className="hover:bg-bloomberg-bg-tertiary/50">
                                                            <td className="font-medium terminal-text py-2 px-3 text-sm">{trade.pair}</td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                    trade.direction === 'LONG'
                                                                        ? 'bg-bloomberg-success/20 text-bloomberg-success'
                                                                        : 'bg-bloomberg-danger/20 text-bloomberg-danger'
                                                                }`}>
                                                                    {trade.direction}
                                                                </span>
                                                            </td>
                                                            <td className="terminal-text py-2 px-3">{trade.volume}</td>
                                                            <td className="terminal-text py-2 px-3">{Number(trade.entry_price).toFixed(5)}</td>
                                                            <td className="terminal-text py-2 px-3">
                                                                {trade.exit_price ? Number(trade.exit_price).toFixed(5) : '-'}
                                                            </td>
                                                            <td className={`font-bold terminal-text py-2 px-3 text-sm ${
                                                                Number(trade.net_profit || 0) > 0 ? 'text-bloomberg-success' : 'text-bloomberg-danger'
                                                            }`}>
                                                                {trade.status === 'CLOSED' ? `$${Number(trade.net_profit || 0).toFixed(2)}` : '-'}
                                                            </td>
                                                            <td className="text-xs text-bloomberg-text-muted py-2 px-3">{trade.session}</td>
                                                            <td className="py-2 px-3">
                                                                <span className={`px-2 py-1 rounded text-xs ${
                                                                    trade.status === 'OPEN'
                                                                        ? 'bg-bloomberg-accent/20 text-bloomberg-accent'
                                                                        : 'bg-bloomberg-text-muted/20 text-bloomberg-text-muted'
                                                                }`}>
                                                                    {trade.status}
                                                                </span>
                                                            </td>
                                                            <td className="text-xs text-bloomberg-text-muted py-2 px-3">
                                                                {new Date(trade.status === 'OPEN' ? trade.open_time : trade.close_time).toLocaleDateString('en-US', { 
                                                                    month: 'short', day: 'numeric', year: 'numeric' 
                                                                })}
                                                            </td>
                                                            {customColumns.map(col => (
                                                                <td key={col.id} className="py-2 px-3">
                                                                    {renderCustomCell(trade, col)}
                                                                </td>
                                                            ))}
                                                            <td className="py-2 px-3">
                                                                <button
                                                                    onClick={() => handleDeleteTrade(trade.id)}
                                                                    className="p-1 hover:bg-bloomberg-danger/20 rounded transition-colors"
                                                                    title="Delete trade"
                                                                >
                                                                    <Trash2 size={14} className="text-bloomberg-danger" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination for Fullscreen */}
                                        {filteredTrades.length > tradesPerPage && (
                                            <div className="flex items-center justify-center space-x-2 mt-4">
                                                <button
                                                    onClick={() => setCurrentFullscreenPage(prev => Math.max(1, prev - 1))}
                                                    disabled={currentFullscreenPage === 1}
                                                    className="px-3 py-2 bg-bloomberg-bg-secondary hover:bg-bloomberg-bg-tertiary 
                                                             disabled:opacity-30 disabled:cursor-not-allowed rounded text-xs
                                                             text-bloomberg-text-primary transition-colors"
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                                
                                                {(() => {
                                                    const totalPages = Math.ceil(filteredTrades.length / tradesPerPage);
                                                    const pages = [];
                                                    
                                                    if (totalPages <= 7) {
                                                        for (let i = 1; i <= totalPages; i++) {
                                                            pages.push(i);
                                                        }
                                                    } else {
                                                        if (currentFullscreenPage <= 4) {
                                                            pages.push(1, 2, 3, 4, 5, '...', totalPages);
                                                        } else if (currentFullscreenPage >= totalPages - 3) {
                                                            pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                                                        } else {
                                                            pages.push(1, '...', currentFullscreenPage - 1, currentFullscreenPage, currentFullscreenPage + 1, '...', totalPages);
                                                        }
                                                    }
                                                    
                                                    return pages.map((page, idx) => (
                                                        page === '...' ? (
                                                            <span key={`ellipsis-${idx}`} className="px-2 text-bloomberg-text-muted">...</span>
                                                        ) : (
                                                            <button
                                                                key={page}
                                                                onClick={() => setCurrentFullscreenPage(page)}
                                                                className={`px-3 py-2 rounded text-xs transition-colors ${
                                                                    currentFullscreenPage === page
                                                                        ? 'bg-bloomberg-accent text-bloomberg-bg-primary font-bold'
                                                                        : 'bg-bloomberg-bg-secondary hover:bg-bloomberg-bg-tertiary text-bloomberg-text-primary'
                                                                }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        )
                                                    ));
                                                })()}
                                                
                                                <button
                                                    onClick={() => setCurrentFullscreenPage(prev => Math.min(Math.ceil(filteredTrades.length / tradesPerPage), prev + 1))}
                                                    disabled={currentFullscreenPage === Math.ceil(filteredTrades.length / tradesPerPage)}
                                                    className="px-3 py-2 bg-bloomberg-bg-secondary hover:bg-bloomberg-bg-tertiary 
                                                             disabled:opacity-30 disabled:cursor-not-allowed rounded text-xs
                                                             text-bloomberg-text-primary transition-colors"
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Column Modal */}
            {showColumnModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card-bloomberg rounded-lg p-4 w-[400px] max-w-[90vw]">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-bloomberg-text-primary">Add Custom Column</h3>
                            <button
                                onClick={() => setShowColumnModal(false)}
                                className="p-1 hover:bg-bloomberg-bg-tertiary rounded"
                            >
                                <X size={14} className="text-bloomberg-text-muted" />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] text-bloomberg-text-muted mb-1">Column Name</label>
                                <input
                                    type="text"
                                    value={newColumnName}
                                    onChange={(e) => setNewColumnName(e.target.value)}
                                    placeholder="e.g., Strategy, Notes, Rating"
                                    className="input-bloomberg w-full px-2 py-1.5 text-xs"
                                    autoFocus
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] text-bloomberg-text-muted mb-1">Column Type</label>
                                <select
                                    value={newColumnType}
                                    onChange={(e) => setNewColumnType(e.target.value)}
                                    className="input-bloomberg w-full px-2 py-1.5 text-xs"
                                >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="select">Select (High/Medium/Low)</option>
                                    <option value="checkbox">Checkbox</option>
                                    <option value="date">Date</option>
                                </select>
                            </div>
                            
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowColumnModal(false)}
                                    className="px-3 py-1.5 text-xs text-bloomberg-text-muted hover:bg-bloomberg-bg-tertiary rounded transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addCustomColumn}
                                    disabled={!newColumnName.trim()}
                                    className="px-3 py-1.5 text-xs bg-bloomberg-accent text-white rounded hover:bg-bloomberg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add Column
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
