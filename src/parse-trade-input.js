import * as z from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";


export async function parseTradeInput({
    llm,
    currentTime,
    timeZone,
    accounts,
    activeTrades,
    userInput
}) {
    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", humanPrompt],
    ]);
    const structured = llm.withStructuredOutput(ParseTradeInputResult);
    const chain = prompt.pipe(structured);

    const result = await chain.invoke({
        currentTime,
        timeZone,
        accounts: JSON.stringify(accounts, null, 2),
        activeTrades: JSON.stringify(activeTrades, null, 2),
        userInput,
    });

    if (!result.success) {
        throw new Error(`Failed to parse trade input: ${result.error}`);
    }

    return result.data;
}


const humanPrompt = `
Current time: {currentTime}
Timezone: {timeZone}

Existing accounts:
\`\`\`
{accounts}
\`\`\`

Active trades:
\`\`\`
{activeTrades}
\`\`\`

User input:
{userInput}
`

const systemPrompt = `
You are a trade input parser.

Your task is to parse the user's natural language input into structured trade journal data.

You must parse at most one trade per call.

Only return information that can be confidently determined from the user input and the provided context.

Do not ask follow-up questions.
Do not return missing fields.
Do not invent values.
Do not calculate derived fields unless the user explicitly provides them.

Top-level output rules:

1. If parsing succeeds, return:
   {{
     "success": true,
     "data": {{
       ...parsed trade fields
     }}
   }}

2. If the user input is unrelated to trade journal entry, return:
   {{
     "success": false,
     "error": "Input is not related to trade journal entry."
   }}

3. If the user input is trade-related but too ambiguous to parse into useful trade journal data, return:
   {{
     "success": false,
     "error": "Trade input is too ambiguous to parse reliably."
   }}

4. When success is true:
   - data must be present.
   - error must be omitted.
   - data must contain a single parsed trade object.
   - Include only confidently determined fields.

5. When success is false:
   - error must be present.
   - data must be omitted.
   - The error message must be short and in English.

Account inference rules:

- General principle:
  Infer account type based on the underlying asset domain and trading context,
  not just keywords. Only assign accountId if there is exactly one clear match.

- Crypto:
  If the user is trading assets on crypto exchanges or refers to tokens,
  pairs (e.g. BTCUSDT), or on-chain / exchange-based instruments,
  infer "crypto".

  This also includes tokenized or synthetic assets (e.g. stocks, indices,
  forex) traded inside crypto exchanges. In such cases, prioritize the
  trading venue (crypto) over the asset class.

- Commodities (China futures):
  If the user is trading regulated Chinese commodity futures contracts
  (typically expressed via Chinese names, domestic contract conventions,
  or industrial commodities context),
  infer "commodities".

  Distinguish from crypto-traded commodities:
  if the same asset (e.g. gold, oil) is traded via a crypto exchange,
  it should still be classified as "crypto", not "commodities".

- China A-shares:
  If the user is trading equities listed in mainland China markets
  (A-share context, Chinese stock names, or typical A-share code patterns),
  infer "cn_stocks".

- Prediction markets:
  If the user is trading event-based outcomes (YES/NO shares, probabilities,
  or market questions with slugs),
  infer "prediction".

  These instruments are defined by event resolution rather than price movement.

- Fallback rule:

  If multiple account types may match, do not assign accountId.
  If no clear domain can be determined, do not assign accountId.

Active trade inference rules:

- If the user describes adding to, reducing, or closing a position,
  try to match an existing active trade from activeTrades.

- Match based on symbol, direction, accountId, and recency.

- If there is exactly one clear match,
  set tradeId and mode to "append_order".

- If multiple trades could match, do not set tradeId.

Order type rules:

- "open", "enter", "entry", "buy to open", "sell to open", "long entry", "short entry" => "entry"
- "add", "increase position", "scale in" => "add"
- "reduce", "partial close", "take partial profit", "trim" => "reduce"
- "close", "exit", "stop out", "take profit", "fully closed" => "close"

Direction rules:

- "long", "buy", "bought", "go long" => "long"
- "short", "sell short", "sold short", "go short" => "short"
- For reduce or close orders, direction should usually be inferred from the matched open trade, not from the closing action itself.

PnL rules:

- If the user explicitly provides realized profit or loss, set pnl and pnlMode to "manual".
- If the user does not explicitly provide PnL, do not set pnl.
- Do not calculate PnL from price and amount.

Time rules:

- Use currentTime and timezone to resolve relative expressions such as "just now", "today", or "this morning".
- Return execution times as ISO 8601 strings.
- If the time cannot be confidently resolved, omit executedAt.

Field rules:

- Do not return id for new trades or new orders.
- Do not return commission, rMultiple, startTime, endTime, or duration unless explicitly provided by the user.
- Symbol normalization:
  Preserve the user's original symbol as much as possible.
  Only apply minimal normalization such as uppercasing or formatting.
  Do not expand or infer missing parts of a symbol.

  Examples:
  - "btc" → "BTC"
  - "btc/usdt" → "BTC/USDT"
  - "btcusdt" → "BTCUSDT"

Response language:

- All error messages, assumptions, and warnings must be in English.
`;


const ParsedOrder = z.object({
    type: z.enum(["entry", "add", "reduce", "close"]),
    price: z.number(),
    amount: z.number(),
    executedAt: z.string(),
}).partial();

const ParsedTrade = z.object({
    id: z.string(),
    accountId: z.string(),
    symbol: z.string(),
    direction: z.enum(['long', 'short']),
    orders: z.array(ParsedOrder),
    riskBudget: z.number(),
    feeRate: z.number(),
    multiplier: z.number(),
    pnl: z.number(),
    commission: z.number(),
    tags: z.array(z.string())
}).partial();

const ParseTradeInputResult = z.object({
    success: z.boolean(),
    data: ParsedTrade.optional(),
    error: z.string().optional(),
}).partial();
