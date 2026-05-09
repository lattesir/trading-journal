import * as z from "zod";
import { DateTime } from "luxon";
import { id } from "zod/locales";

export const Account = z.object({
    id: z.string()
        .describe("Unique identifier of the account"),

    name: z.string()
        .describe("Display name of the account"),

    type: z.string()
        .describe("Account type, e.g. forex or crypto"),

    currency: z.string()
        .describe("Base currency of the account, e.g. USD or CNY"),

    initialBalance: z.number()
        .describe("Initial balance of the account"),

    feeRate: z.number()
        .describe("Default fee rate as a decimal"),

    riskPercent: z.number()
        .describe("Risk percentage used to determine a trade's risk when not specified")
}).partial();

export const AccountFilter = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string()
}).partial();

const DateLike = z.union([
    z.date(),
    z.string(),
]).transform((val, ctx) => {
    if (typeof val !== 'string') {
        return val;
    }

    let dt;

    try {
        dt = DateTime.fromISO(val);
        if (!dt.isValid) {
            dt = DateTime.fromSQL(val);
        }
    } catch (e) {
        //ignore
    }

    if (!dt || !dt.isValid) {
        ctx.addIssue({
            code: 'custom',
            message: 'Invalid date string',
            input: val
        })
        return z.NEVER;
    } else {
        return dt.toJSDate();
    }
});

export const OrderDoc = z.object({
    _id: z.string().describe("Unique identifier of the order"),

    type: z.enum(['entry', 'add', 'reduce', 'close'])
        .describe("Order role within the trade lifecycle"),

    price: z.number().gt(0)
        .describe("Execution price of the order"),

    amount: z.number().gt(0)
        .describe("Executed amount of the order"),

    executedAt: DateLike
        .describe("Execution time as an ISO 8601 string or Date object.")
});

export const NewOrder = OrderDoc.omit({ _id: true });
export const NewOrdersArray = z.array(NewOrder).min(1);

export const TradeDoc = z.object({
    _id: z.string().describe("Unique identifier of the trade"),

    accountId: z.string()
        .describe("Identifier of the related account"),

    symbol: z.string()
        .describe("Trading symbol, e.g. BTCUSDT or EURUSD"),

    direction: z.enum(['long', 'short'])
        .describe("Trade direction"),

    orders: z.array(OrderDoc).min(1)
        .describe("All orders associated with the trade"),

    riskBudget: z.number().gt(0).optional()
        .describe("Maximum allowed loss for the trade"),

    feeRate: z.number().optional()
        .describe("Trading fee rate for this trade, expressed as a decimal"),

    multiplier: z.number().positive().default(1)
        .describe("Unit multiplier used to calculate notional value."),

    pnl: z.number().optional()
        .describe("Realized PnL of the trade"),

    pnlMode: z.enum(['auto', 'manual']).optional()
        .describe("Indicates whether PnL is provided by the user or calculated automatically by the system."),

    commission: z.number().optional()
        .describe("Total commission paid for this trade"),

    rMultiple: z.number().optional()
        .describe("Risk-normalized return: pnl / riskBudget"),

    startTime: z.date().optional()
        .describe("Start time of the trade, based on the first executed order"),

    endTime: z.date().optional()
        .describe("End time of the trade, based on the final executed order"),

    duration: z.number().min(0).optional()
        .describe("Trade duration in seconds"),

    tags: z.array(z.string()).optional()
        .describe("Tags used to categorize the trade for filtering and analysis."),
});

export const RecordTradeInput = TradeDoc
    .pick({
        accountId: true,
        symbol: true,
        direction: true,
        riskBudget: true,
        feeRate: true,
        multiplier: true,
        pnl: true,
        commission: true,
        tags: true
    })
    .extend({
        orders: NewOrdersArray
    });

export const OpenTradeInput = TradeDoc
    .pick({
        accountId: true,
        symbol: true,
        direction: true,
        riskBudget: true,
        feeRate: true,
        multiplier: true,
        tags: true
    })
    .extend({
        orders: NewOrdersArray
    });

export const CloseTradeInput = TradeDoc
    .pick({
        pnl: true,
        commission: true,
        tags: true,
    })
    .extend({
        orders: NewOrdersArray
    });

export const Tags = z.array(z.string()).optional();

const TimeRange = z.union([
    z.object({ since: DateLike.optional(), until: DateLike.optional() }),
    z.enum(['day', 'week', 'month']),
]).transform((val) => {
    if (typeof val !== 'string') {
        return val;
    }

    const dt = DateTime.now();
    const since = dt.startOf(val).toJSDate();
    const until = dt.endOf(val).toJSDate();
    return { since, until };
});

export const TradeFilter = z.object({
    id: z.string(),
    accountId: z.string(),
    symbol: z.string(),
    tags: z.array(z.string()).min(1),
    status: z.enum(['active', 'closed']).default('closed'),
    timeRange: TimeRange,
    limit: z.number(),
}).partial();

