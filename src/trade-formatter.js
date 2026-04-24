import { DateTime } from "luxon";

export class TradeFormatter {
    constructor() {
        this.locale = DateTime.now().locale;
    }

    format(trade) {
        if (!trade.endTime) {
            throw new Error('Only closed trade can be formatted');
        }

        const result = {
            'Trade ID': trade.id,
            'Account ID': trade.accountId,
            'Symbol': trade.symbol,
            'Direction': trade.direction.toUpperCase(),
            'Realized PnL': trade.pnl.toFixed(1),
            'R-Multiple': trade.rMultiple.toFixed(2),
            'Duration': this._formatDuration(trade.duration),
            'End Time': this._formatDate(trade.endTime)
        }

        if (trade.tags?.length) {
            result['Tags'] = trade.tags;
        }

        return result;
    }

    formatSummary(summary) {
        return {
            'Total Trades': String(summary.totalTrades),
            'Total PnL': summary.totalPnl.toFixed(0),
            'Avg PnL': summary.avgPnl.toFixed(1),
            'Avg R-Multiple': summary.avgRMultiple.toFixed(2),
            'Win Rate': this._formatPercent(summary.winRate),
            'P/L Ratio': this._formatPercent(summary.profitFactor),
            'Max Win': summary.maxWin.toFixed(0),
            'Max Loss': summary.maxLoss.toFixed(0),
            'Total Commission': summary.totalCommission.toFixed(0),
        }
    }

    _formatPercent(value, fractionDigits = 0) {
        if (Number.isNaN(value)) {
            return 'N/A';
        }

        return new Intl.NumberFormat(this.locale, {
            style: 'percent',
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(value);
    };

    _formatDate(date) {
        const dt = DateTime.fromJSDate(date);
        return dt.toLocaleString(DateTime.DATETIME_MED);
    }

    _formatDuration(seconds) {
        if (seconds < 0) {
            throw new Error("seconds must be >= 0");
        }

        const DAY = 86400;
        const HOUR = 3600;
        const MINUTE = 60;

        const days = Math.floor(seconds / DAY);
        const hours = Math.floor((seconds % DAY) / HOUR);
        const minutes = Math.floor((seconds % HOUR) / MINUTE);
        const secs = Math.floor(seconds % 60);

        const plural = (value, unit) => {
            return `${value} ${unit}${value === 1 ? '' : 's'}`;
        };

        if (days > 10) {
            return plural(days, 'day');
        }

        if (days > 0) {
            if (hours > 0) {
                return `${plural(days, 'day')} ${plural(hours, 'hour')}`;
            }
            return plural(days, 'day');
        }

        if (hours > 10) {
            return plural(hours, 'hour');
        }

        if (hours > 0) {
            if (minutes > 0) {
                return `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`;
            }
            return plural(hours, 'hour');
        }

        if (minutes > 0) {
            return plural(minutes, 'minute');
        }

        return plural(secs, 'second');
    }
}
