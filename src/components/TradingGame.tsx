import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type TouchEvent as ReactTouchEvent,
} from "react";

type Candle = {
    open: number;
    high: number;
    low: number;
    close: number;
};

type CsvCandle = Candle & {
    time?: string;
};

type PathPoint = {
    t: number;
    price: number;
};

type ActivePlan = Candle & {
    path: PathPoint[];
};

type MarketState = {
    loaded: boolean;
    status: string;
    closedCandles: Candle[];
    activeCandle: Candle;
    plannedCandle: ActivePlan | null;
    dataIndex: number;

    // This means: how many 15m candles have closed since the game started.
    // At app load it starts at 0 so 30m/1h/4h/Daily timers begin fresh.
    active15mIndex: number;
    activeCandleTimeMs: number | null; // <--- changed
};

type Position = {
    side: "long" | "short";
    entry: number;
    quantity: number;
};

type PendingOrder = {
    price: number;
    side: "long" | "short";
    quantity: number;
    confirmed: boolean;
    showControls: boolean;
    controlsOpacity: number; // <--- added
    hideCheckWhenConfirmed?: boolean; // <--- changed
    reopenedTrashOnly?: boolean; // <--- changed
    armedForFill?: boolean; // <--- changed
};

type ExitLine = {
    price: number;
    kind: "tp" | "sl";
    showTrash: boolean;
    active?: boolean; // <--- changed
};

type HitBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type ChartMetrics = {
    width: number;
    height: number;
    paddedHighest: number;
    paddedLowest: number;
    paddedRange: number;
};

const GREEN = "#14c78a";
const RED = "#ff4048";
const PENDING_BUTTON_BLUE = "#2f8cff"; // <--- changed
const DIM_GREEN_LINE = "rgba(20, 199, 138, 0.42)"; // <--- changed
const DIM_RED_LINE = "rgba(255, 64, 72, 0.42)"; // <--- changed
const DIM_BLUE_LINE = "rgba(47, 140, 255, 0.42)"; // <--- changed
const DIM_ENTRY_LINE = "rgba(255, 255, 255, 0.42)"; // <--- changed
const LIGHT_GREEN_LINE = "rgba(20, 199, 138, 0.72)"; // <--- changed
const LIGHT_RED_LINE = "rgba(255, 64, 72, 0.72)"; // <--- changed
const LIGHT_BLUE_LINE = "rgba(47, 140, 255, 0.72)"; // <--- changed
const LIGHT_ENTRY_LINE = "rgba(255, 255, 255, 0.72)"; // <--- changed
const RAW_DISPLAY_BASE = 49.90;
const GOLD_DISPLAY_BASE = 4990.00;
const GOLD_TICK_SIZE = 0.10;
const CONTRACT_VALUE = 100;

const CSV_PATH = "/data/xagusd_15m_from_ctf_clean.csv";

const TIMEFRAME_SECONDS: Record<string, number> = {
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "4h": 240,
    "Daily": 1440, // 24 minutes
};

const HISTORY_BASE_CANDLES = 9000;
const MAX_BASE_CANDLES = 10000;
const TRIM_BASE_CANDLES = 96;



function formatCountdown(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const m = Math.floor(safeSeconds / 60);
    const s = safeSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function getMarketSessionName(timestamp: number) {
    const date = new Date(timestamp);

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    const minutes = hour * 60 + minute;

    if (minutes >= 18 * 60 || minutes < 2 * 60) return "Asian"; // <--- changed
    if (minutes >= 2 * 60 && minutes < 7 * 60) return "London"; // <--- changed
    if (minutes >= 7 * 60 && minutes < 9 * 60 + 30) return "Pre New York"; // <--- changed
    if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "New York"; // <--- changed
    if (minutes >= 16 * 60 && minutes < 18 * 60) return "After Hours"; // <--- changed

    return "Market"; // <--- changed
}

function formatMarketDateTime(timestamp: number) {
    const date = new Date(timestamp);

    const day = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "long",
    }).format(date);

    const time = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(date);

    return `${day} ${time} ET`; // <--- changed
}

function getSimulatedMarketProgressMs(elapsedInside15mMs: number) {
    const simulatedCandleDurationMs = TIMEFRAME_SECONDS["15m"] * 1000;
    const realMarketCandleDurationMs = 15 * 60 * 1000;

    const progress = clamp(
        elapsedInside15mMs / simulatedCandleDurationMs,
        0,
        1
    );

    return progress * realMarketCandleDurationMs; // <--- changed
}

function getTimeframeMarketMinutes(tf: string) {
    if (tf === "30m") return 30;
    if (tf === "1h") return 60;
    if (tf === "4h") return 240;
    if (tf === "Daily") return 1440;

    return 15;
}

function getAlignedMarketDisplayTimestamp(
    active15mTimestamp: number,
    elapsedInside15mMs: number
) {
    return active15mTimestamp + getSimulatedMarketProgressMs(elapsedInside15mMs); // <--- changed: market time stays true to CSV candle time
}

function getEasternParts(timestamp: number) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(new Date(timestamp));

    const getPart = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? "0";

    return {
        weekday: getPart("weekday"),
        hour: Number(getPart("hour")),
        minute: Number(getPart("minute")),
        second: Number(getPart("second")),
    };
}

function getRealSecondsUntilTimeframeClose(timestamp: number, tf: string) {
    const { weekday, hour, minute, second } = getEasternParts(timestamp);
    const secondsIntoDay = hour * 3600 + minute * 60 + second;

    if (tf === "Daily") {
        const isFriday = weekday === "Friday";
        const marketCloseSeconds = isFriday ? 17 * 3600 : 24 * 3600;
        return Math.max(0, marketCloseSeconds - secondsIntoDay); // <--- changed
    }

    const tfMinutes = getTimeframeMarketMinutes(tf);
    const tfSeconds = tfMinutes * 60;
    const secondsIntoBlock = secondsIntoDay % tfSeconds;
    const remaining = tfSeconds - secondsIntoBlock;

    return remaining === tfSeconds ? tfSeconds : remaining; // <--- changed
}

function convertRealMarketSecondsToSimMs(realSeconds: number) {
    const real15mSeconds = 15 * 60;
    const simulated15mMs = TIMEFRAME_SECONDS["15m"] * 1000;

    return (realSeconds / real15mSeconds) * simulated15mMs; // <--- changed
}

function formatMoney(value: number) {
    const sign = value < 0 ? "-" : "";
    const formattedValue = Math.round(Math.abs(value)).toLocaleString("en-US"); // <--- changed

    return `${sign}$${formattedValue}`;
}

function toGoldDisplayPrice(rawPrice: number) {
    const unroundedGoldPrice = GOLD_DISPLAY_BASE + (rawPrice - RAW_DISPLAY_BASE) * 10;

    return Math.round(unroundedGoldPrice / GOLD_TICK_SIZE) * GOLD_TICK_SIZE;
}

function randomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function chance(percent: number) {
    return Math.random() < percent;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function getGroupSize(timeframe: string) {
    if (timeframe === "30m") return 2;
    if (timeframe === "1h") return 4;
    if (timeframe === "4h") return 16;
    if (timeframe === "Daily") return 96;
    return 1;
}

function parseNumber(value: string | undefined) {
    if (!value) return NaN;
    return Number(value.replace(/"/g, "").trim());
}

function parseCsvTimestamp(value: string | undefined) {
    if (!value) return null;

    const cleaned = value.replace(/"/g, "").trim();
    if (!cleaned) return null;

    const direct = Date.parse(cleaned);
    if (Number.isFinite(direct)) return direct;

    const normalized = cleaned.includes("T")
        ? cleaned
        : cleaned.replace(" ", "T");

    const withEasternOffset = Date.parse(`${normalized}-04:00`);
    if (Number.isFinite(withEasternOffset)) return withEasternOffset;

    return null;
}

function parseCsvCandles(csvText: string): CsvCandle[] {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length <= 1) return [];

    const header = lines[0]
        .split(",")
        .map((h) => h.replace(/"/g, "").trim().toLowerCase());

    const timeIndex = header.findIndex(
        (h) => h === "time" || h === "date" || h === "datetime"
    );
    const openIndex = header.findIndex((h) => h === "open");
    const highIndex = header.findIndex((h) => h === "high");
    const lowIndex = header.findIndex((h) => h === "low");
    const closeIndex = header.findIndex((h) => h === "close");

    if (
        openIndex === -1 ||
        highIndex === -1 ||
        lowIndex === -1 ||
        closeIndex === -1
    ) {
        throw new Error("CSV must contain open, high, low, close columns.");
    }

    const candles: CsvCandle[] = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");

        const open = parseNumber(parts[openIndex]);
        const high = parseNumber(parts[highIndex]);
        const low = parseNumber(parts[lowIndex]);
        const close = parseNumber(parts[closeIndex]);

        if (
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close)
        ) {
            continue;
        }

        const bodyTop = Math.max(open, close);
        const bodyBottom = Math.min(open, close);

        candles.push({
            time:
                timeIndex >= 0
                    ? parts[timeIndex]?.replace(/"/g, "").trim()
                    : undefined,
            open,
            high: Math.max(high, bodyTop),
            low: Math.min(low, bodyBottom),
            close,
        });
    }

    return candles;
}

function applyRealCandleShape(raw: CsvCandle, newOpen: number): Candle {
    const rawBodyMove = raw.close - raw.open;
    const rawBodyTop = Math.max(raw.open, raw.close);
    const rawBodyBottom = Math.min(raw.open, raw.close);

    const rawTopWick = Math.max(0, raw.high - rawBodyTop);
    const rawBottomWick = Math.max(0, rawBodyBottom - raw.low);

    const bodyScale = randomBetween(0.94, 1.06);
    const wickScale = randomBetween(0.92, 1.1);

    const close = newOpen + rawBodyMove * bodyScale;

    const bodyTop = Math.max(newOpen, close);
    const bodyBottom = Math.min(newOpen, close);

    return {
        open: newOpen,
        close,
        high: bodyTop + rawTopWick * wickScale,
        low: bodyBottom - rawBottomWick * wickScale,
    };
}

function buildContinuousHistory(
    data: CsvCandle[],
    startIndex: number,
    count: number
) {
    const candles: Candle[] = [];

    let index = startIndex;
    let currentOpen = data[startIndex % data.length].open;

    for (let i = 0; i < count; i++) {
        const raw = data[index % data.length];
        const candle = applyRealCandleShape(raw, currentOpen);

        candles.push(candle);

        currentOpen = candle.close;
        index += 1;
    }

    return {
        candles,
        nextIndex: index % data.length,
        lastClose: currentOpen,
    };
}

function createActivePlan(candle: Candle): ActivePlan {
    const bullish = candle.close >= candle.open;
    const doji = Math.abs(candle.close - candle.open) < 0.03;

    const path: PathPoint[] = [{ t: 0, price: candle.open }];

    if (doji) {
        if (chance(0.5)) {
            path.push({ t: randomBetween(0.16, 0.34), price: candle.high });
            path.push({ t: randomBetween(0.5, 0.78), price: candle.low });
        } else {
            path.push({ t: randomBetween(0.16, 0.34), price: candle.low });
            path.push({ t: randomBetween(0.5, 0.78), price: candle.high });
        }
    } else if (bullish) {
        if (chance(0.72)) {
            path.push({ t: randomBetween(0.1, 0.3), price: candle.low });
            path.push({ t: randomBetween(0.48, 0.78), price: candle.high });
        } else {
            path.push({ t: randomBetween(0.15, 0.35), price: candle.high });
            path.push({ t: randomBetween(0.56, 0.8), price: candle.low });
        }
    } else {
        if (chance(0.72)) {
            path.push({ t: randomBetween(0.1, 0.3), price: candle.high });
            path.push({ t: randomBetween(0.48, 0.78), price: candle.low });
        } else {
            path.push({ t: randomBetween(0.15, 0.35), price: candle.low });
            path.push({ t: randomBetween(0.56, 0.8), price: candle.high });
        }
    }

    path.push({ t: 1, price: candle.close });
    path.sort((a, b) => a.t - b.t);

    return {
        ...candle,
        path,
    };
}

function candleFromPlanAtProgress(plan: ActivePlan, progress: number): Candle {
    const p = clamp(progress, 0, 1);

    let left = plan.path[0];
    let right = plan.path[plan.path.length - 1];

    for (let i = 0; i < plan.path.length - 1; i++) {
        const a = plan.path[i];
        const b = plan.path[i + 1];

        if (p >= a.t && p <= b.t) {
            left = a;
            right = b;
            break;
        }
    }

    const segmentRange = Math.max(right.t - left.t, 0.0001);
    const localProgress = clamp((p - left.t) / segmentRange, 0, 1);
    const smoothProgress =
        localProgress * localProgress * (3 - 2 * localProgress);

    let liveClose =
        left.price + (right.price - left.price) * smoothProgress;

    if (p > 0.03 && p < 0.97) {
        liveClose += randomBetween(-0.01, 0.01);
    }

    liveClose = clamp(liveClose, plan.low, plan.high);

    const visitedPoints = plan.path.filter((point) => point.t <= p);
    const visitedPrices = [
        ...visitedPoints.map((point) => point.price),
        liveClose,
        plan.open,
    ];

    const liveHigh = Math.max(...visitedPrices);
    const liveLow = Math.min(...visitedPrices);

    return {
        open: plan.open,
        high: Math.min(Math.max(liveHigh, plan.open, liveClose), plan.high),
        low: Math.max(Math.min(liveLow, plan.open, liveClose), plan.low),
        close: liveClose,
    };
}

function makeAggregatedCandle(group: Candle[]): Candle {
    return {
        open: group[0].open,
        close: group[group.length - 1].close,
        high: Math.max(...group.map((c) => c.high)),
        low: Math.min(...group.map((c) => c.low)),
    };
}

// Higher timeframe aggregation respects the current live group.
// Example: Daily starts as 1 active 15m candle, then grows until 96 15m candles.
function aggregateCandles(
    base: Candle[],
    timeframe: string,
    completed15mSinceStart: number
): Candle[] {
    const groupSize = getGroupSize(timeframe);

    if (groupSize === 1) return base;

    const currentGroupCount = (completed15mSinceStart % groupSize) + 1;
    const currentStart = Math.max(0, base.length - currentGroupCount);

    const historyPart = base.slice(0, currentStart);
    const currentGroup = base.slice(currentStart);

    const historyReversed: Candle[] = [];

    for (let end = historyPart.length; end > 0; end -= groupSize) {
        const start = Math.max(0, end - groupSize);
        const group = historyPart.slice(start, end);
        if (group.length === 0) continue;

        historyReversed.push(makeAggregatedCandle(group));
    }

    const result = historyReversed.reverse();

    if (currentGroup.length > 0) {
        result.push(makeAggregatedCandle(currentGroup));
    }

    return result;
}

function fallbackCandles(): CsvCandle[] {
    let price = 25;
    const candles: CsvCandle[] = [];

    for (let i = 0; i < 10000; i++) {
        const open = price;
        const close = open + randomBetween(-0.12, 0.12);
        const high = Math.max(open, close) + randomBetween(0.02, 0.15);
        const low = Math.min(open, close) - randomBetween(0.02, 0.15);

        candles.push({ open, high, low, close });
        price = close;
    }

    return candles;
}

export default function TradingGame() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const appStartRef = useRef(Date.now());
    const fallbackMarketSessionStartRef = useRef(new Date("2026-05-18T08:30:00-04:00").getTime()); // <--- changed
    const csvCandlesRef = useRef<CsvCandle[]>([]);
    const pauseStartedAtRef = useRef<number | null>(null); // <--- changed
    const totalPausedMsRef = useRef(0); // <--- changed

    function getSimElapsedMs() {
        const currentPauseDuration =
            simulationPausedRef.current && pauseStartedAtRef.current !== null
                ? Date.now() - pauseStartedAtRef.current
                : 0;

        return Math.max(
            0,
            Date.now() -
            appStartRef.current -
            totalPausedMsRef.current -
            currentPauseDuration
        ); // <--- changed
    }

    const [balance, setBalance] = useState(10000);
    const [timeframe, setTimeframe] = useState("15m");
    const [quantity, setQuantity] = useState(1);
    const [now, setNow] = useState(Date.now());
    const [isLandscape, setIsLandscape] = useState(false); // <--- changed
    const [settingsOpen, setSettingsOpen] = useState(false); // <--- changed
    const [simulationPaused, setSimulationPaused] = useState(false); // <--- changed
    const simulationPausedRef = useRef(false); // <--- changed
    const [bullCandleColor, setBullCandleColor] = useState(GREEN); // <--- changed
    const [bearCandleColor, setBearCandleColor] = useState(RED); // <--- changed
    const [visibleTimeframes, setVisibleTimeframes] = useState<Record<string, boolean>>({ // <--- changed
        "15m": true,
        "30m": true,
        "1h": true,
        "4h": true,
        Daily: true,
    });

    const [market, setMarket] = useState<MarketState>(() => ({
        loaded: false,
        status: "Loading XAGUSD data...",
        closedCandles: [],
        activeCandle: {
            open: 25,
            high: 25,
            low: 25,
            close: 25,
        },
        plannedCandle: null,
        dataIndex: 0,
        active15mIndex: 0,
        activeCandleTimeMs: null, // <--- changed
    }));

    const [price, setPrice] = useState(25);

    const [position, setPosition] = useState<Position | null>(null);

    const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

    const chartMetricsRef = useRef<ChartMetrics | null>(null);
    const pendingCheckHitBoxRef = useRef<HitBox | null>(null);
    const pendingTrashHitBoxRef = useRef<HitBox | null>(null);
    const pendingLeftArrowHitBoxRef = useRef<HitBox | null>(null); // <--- changed
    const pendingRightArrowHitBoxRef = useRef<HitBox | null>(null); // <--- changed
    const positionTrashHitBoxRef = useRef<HitBox | null>(null); // <--- changed
    const [showPositionControls, setShowPositionControls] = useState(false); // <--- changed
    const [positionControlsOpacity, setPositionControlsOpacity] = useState(0); // <--- changed
    const draggingPendingRef = useRef(false);
    const tpTrashHitBoxRef = useRef<HitBox | null>(null);
    const slTrashHitBoxRef = useRef<HitBox | null>(null);
    const [takeProfit, setTakeProfit] = useState<ExitLine | null>(null);
    const [stopLoss, setStopLoss] = useState<ExitLine | null>(null);

    const dragModeRef = useRef<"pending" | "tp" | "sl" | "create-exit" | null>(null);
    const createExitMovedRef = useRef(false); // <--- changed
    const isDraggingExitLineRef = useRef(false); // <--- changed
    const trailingStopModeRef = useRef(false); // <--- changed
    const pendingSideSwipeTimerRef = useRef<number | null>(null); // <--- changed
    const lastTouchActionTimeRef = useRef(0); // <--- changed: prevents mobile touch from firing a second mouse click


    const openPnl = useMemo(() => {
        if (!position) return 0;

        const currentGoldPrice = toGoldDisplayPrice(price);
        const entryGoldPrice = toGoldDisplayPrice(position.entry);

        const difference =
            position.side === "long"
                ? currentGoldPrice - entryGoldPrice
                : entryGoldPrice - currentGoldPrice;

        return difference * position.quantity * CONTRACT_VALUE;
    }, [position, price]);

    useEffect(() => {
        if (!position) return;

        if (balance + openPnl <= 0) {
            setBalance(0);
            setPosition(null);
        }
    }, [position, balance, openPnl]);

    useEffect(() => {
        if (!pendingOrder || !pendingOrder.confirmed || position || balance <= 0) return; // <--- changed

        const fillTolerance = 0.00001; // <--- changed

        const priceMovedAwayFromLine =
            pendingOrder.side === "long"
                ? price < pendingOrder.price - fillTolerance
                : price > pendingOrder.price + fillTolerance; // <--- changed

        if (!pendingOrder.armedForFill) {
            if (priceMovedAwayFromLine) {
                setPendingOrder((prev) =>
                    prev && prev.confirmed
                        ? {
                            ...prev,
                            armedForFill: true, // <--- changed: now it can trigger on the next touch/cross
                        }
                        : prev
                );
            }

            return; // <--- changed: do not fill immediately after confirmation
        }

        const shouldFill =
            pendingOrder.side === "long"
                ? price >= pendingOrder.price - fillTolerance
                : price <= pendingOrder.price + fillTolerance; // <--- changed

        if (!shouldFill) return;

        setPosition({
            side: pendingOrder.side,
            entry: pendingOrder.price,
            quantity: pendingOrder.quantity,
        });

        setPendingOrder(null);
        setShowPositionControls(false); // <--- changed
        setPositionControlsOpacity(0); // <--- changed
    }, [pendingOrder, position, price, balance]);

    useEffect(() => {
        if (!position) return;
        if (isDraggingExitLineRef.current) return; // <--- changed: don't close while dragging TP/SL

        const hitTolerance = 0.00001; // <--- changed: touching TP/SL counts as hit

        const hitTakeProfit =
            !!takeProfit &&
            (position.side === "long"
                ? price >= takeProfit.price - hitTolerance
                : price <= takeProfit.price + hitTolerance); // <--- changed

        if (hitTakeProfit && takeProfit) {
            const projectedPnl = calculateProjectedPnl(
                takeProfit.price,
                position.entry,
                position.quantity,
                position.side
            );

            setBalance((prev) =>
                Math.max(0, Number((prev + projectedPnl).toFixed(2)))
            );

            setPosition(null);
            setTakeProfit(null);
            setStopLoss(null);
            hidePositionControls(); // <--- changed
            return;
        }

        const hitStopLoss =
            !!stopLoss &&
            stopLoss.active !== false && // <--- changed: draft trailing stop is not active until drag release
            !trailingStopModeRef.current && // <--- changed: never close while trailing stop is still being set
            (position.side === "long"
                ? price <= stopLoss.price + hitTolerance
                : price >= stopLoss.price - hitTolerance); // <--- changed

        if (hitStopLoss && stopLoss) {
            const projectedPnl = calculateProjectedPnl(
                stopLoss.price,
                position.entry,
                position.quantity,
                position.side
            );

            setBalance((prev) =>
                Math.max(0, Number((prev + projectedPnl).toFixed(2)))
            );

            setPosition(null);
            setTakeProfit(null);
            setStopLoss(null);
            hidePositionControls(); // <--- changed
        }
    }, [position, price, takeProfit, stopLoss]);

    function handleToggleSimulationPause() {
        setSimulationPaused((prev) => {
            const nextPaused = !prev;
            simulationPausedRef.current = nextPaused; // <--- changed

            if (nextPaused) {
                pauseStartedAtRef.current = Date.now(); // <--- changed
            } else if (pauseStartedAtRef.current !== null) {
                totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current; // <--- changed
                pauseStartedAtRef.current = null; // <--- changed
                setNow(Date.now()); // <--- changed
            }

            return nextPaused;
        });
    }

    function toggleTimeframeVisibility(tf: string) {
        setVisibleTimeframes((prev) => {
            const enabledCount = Object.values(prev).filter(Boolean).length;
            const isCurrentlyEnabled = prev[tf];

            if (isCurrentlyEnabled && enabledCount <= 1) {
                return prev;
            }

            const next = {
                ...prev,
                [tf]: !isCurrentlyEnabled,
            };

            if (!next[timeframe]) {
                const firstVisible = Object.keys(next).find((key) => next[key]);
                if (firstVisible) {
                    setTimeframe(firstVisible);
                }
            }

            return next;
        });
    }

    function resetVisualSettings() {
        setBullCandleColor(GREEN);
        setBearCandleColor(RED);
        setVisibleTimeframes({
            "15m": true,
            "30m": true,
            "1h": true,
            "4h": true,
            Daily: true,
        });
        setTimeframe("15m");
    }

    function canPlaceTrade() {
        return balance > 0 && !position; // <--- changed
    }

    function handleBuy() {
        if (!canPlaceTrade()) return; // <--- changed

        setPosition({
            side: "long",
            entry: price,
            quantity: Math.max(1, quantity || 1),
        });

        setPendingOrder(null); // <--- changed: market order cancels pending setup
        setPendingOrder(null); // <--- changed: market order cancels pending setup
        setTakeProfit(null); // <--- changed
        setStopLoss(null); // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        setShowPositionControls(false); // <--- changed
        setPositionControlsOpacity(0); // <--- changed
    }

    function handleSell() {
        if (!canPlaceTrade()) return; // <--- changed

        setPosition({
            side: "short",
            entry: price,
            quantity: Math.max(1, quantity || 1),
        });

        setTakeProfit(null); // <--- changed
        setStopLoss(null); // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        setShowPositionControls(false); // <--- changed
        setPositionControlsOpacity(0); // <--- changed
    }

    function handleClosePosition() {
        if (!position) return;

        const currentGoldPrice = toGoldDisplayPrice(price);
        const entryGoldPrice = toGoldDisplayPrice(position.entry);

        const difference =
            position.side === "long"
                ? currentGoldPrice - entryGoldPrice
                : entryGoldPrice - currentGoldPrice;

        const realizedPnl = difference * position.quantity * CONTRACT_VALUE;

        setBalance((prev) => {
            const nextBalance = prev + realizedPnl;
            return Math.max(0, Number(nextBalance.toFixed(2)));
        });

        setPosition(null);
        setTakeProfit(null); // <--- changed
        setStopLoss(null); // <--- changed
        setShowPositionControls(false); // <--- changed
        setPositionControlsOpacity(0); // <--- changed
    }

    function handleClosePartials() {
        if (!position) return;

        const contractsToClose = Math.max(
            1,
            Math.min(Math.floor(quantity || 1), position.quantity)
        ); // <--- changed

        const currentGoldPrice = toGoldDisplayPrice(price);
        const entryGoldPrice = toGoldDisplayPrice(position.entry);

        const difference =
            position.side === "long"
                ? currentGoldPrice - entryGoldPrice
                : entryGoldPrice - currentGoldPrice;

        const realizedPnl = difference * contractsToClose * CONTRACT_VALUE;

        setBalance((prev) => {
            const nextBalance = prev + realizedPnl;
            return Math.max(0, Number(nextBalance.toFixed(2)));
        });

        const remainingQuantity = position.quantity - contractsToClose;

        if (remainingQuantity <= 0) {
            setPosition(null);
            setTakeProfit(null);
            setStopLoss(null);
            hidePositionControls();
            return;
        }

        setPosition({
            ...position,
            quantity: remainingQuantity,
        });
    }

    function handleMoveStopToBreakeven() {
        if (!position) return;

        setStopLoss({
            price: position.entry,
            kind: "sl",
            showTrash: false,
            active: true, // <--- changed
        }); // <--- changed
    }

    function handleTrailingStopMode() {
        if (!position) return;

        if (!isPositionInProfit(position)) {
            trailingStopModeRef.current = false; // <--- changed
            isDraggingExitLineRef.current = false; // <--- changed
            return; // <--- changed: trailing stop only works when the position is in profit
        }

        const entryOffset = 0.02; // <--- changed
        const startingStopPrice =
            position.side === "long"
                ? position.entry + entryOffset
                : position.entry - entryOffset; // <--- changed: place slightly above entry for buy, below entry for sell

        setStopLoss({
            price: startingStopPrice,
            kind: "sl",
            showTrash: false,
            active: false, // <--- changed: not active until user drags and lets go
        });

        setTakeProfit((prev) =>
            prev
                ? {
                    ...prev,
                    showTrash: false,
                }
                : prev
        );

        dragModeRef.current = null; // <--- changed: do not auto-drag/follow price
        isDraggingExitLineRef.current = false; // <--- changed
        trailingStopModeRef.current = true; // <--- changed
        hidePositionControls(); // <--- changed
    }

    function getPendingSide(orderPrice: number) {
        return orderPrice >= price ? "long" : "short";
    }

    function canvasYToPrice(y: number) {
        const metrics = chartMetricsRef.current;
        if (!metrics) return price;

        const chartTop = 40;
        const chartHeight = metrics.height - 90;

        const clampedY = clamp(y, chartTop, chartTop + chartHeight);

        return (
            metrics.paddedHighest -
            ((clampedY - chartTop) / chartHeight) * metrics.paddedRange
        );
    }

    function calculateProjectedPnl(
        exitPrice: number,
        entryPrice: number,
        qty: number,
        side: "long" | "short" = "long"
    ) {
        const exitGoldPrice = toGoldDisplayPrice(exitPrice);
        const entryGoldPrice = toGoldDisplayPrice(entryPrice);

        const difference =
            side === "long"
                ? exitGoldPrice - entryGoldPrice
                : entryGoldPrice - exitGoldPrice; // <--- changed

        return difference * qty * CONTRACT_VALUE;
    }

    function isPositionInProfit(activePosition: Position) {
        const currentGoldPrice = toGoldDisplayPrice(price);
        const entryGoldPrice = toGoldDisplayPrice(activePosition.entry);

        return activePosition.side === "long"
            ? currentGoldPrice > entryGoldPrice
            : currentGoldPrice < entryGoldPrice; // <--- changed
    }

    function getExitKindForPrice(
        exitPrice: number,
        entryPrice: number,
        side: "long" | "short"
    ): "tp" | "sl" {
        const isProfitSide =
            side === "long"
                ? exitPrice >= entryPrice
                : exitPrice <= entryPrice; // <--- changed

        return isProfitSide ? "tp" : "sl"; // <--- changed
    }

    function setSingleDraftExitLine(
        exitPrice: number,
        entryPrice: number,
        side: "long" | "short"
    ) {
        const nextKind = getExitKindForPrice(exitPrice, entryPrice, side); // <--- changed

        if (nextKind === "tp") {
            setTakeProfit({
                price: exitPrice,
                kind: "tp",
                showTrash: false,
                active: true, // <--- changed
            });

            setStopLoss(null);
            dragModeRef.current = "tp"; // <--- changed
            return;
        }

        setStopLoss({
            price: exitPrice,
            kind: "sl",
            showTrash: false,
            active: true, // <--- changed
        });

        setTakeProfit(null);
        dragModeRef.current = "sl"; // <--- changed
    }

    function stopPendingSideSwipe() {
        if (pendingSideSwipeTimerRef.current !== null) {
            window.clearInterval(pendingSideSwipeTimerRef.current); // <--- changed
            pendingSideSwipeTimerRef.current = null; // <--- changed
        }
    }

    function cyclePendingOrderSideOnce() {
        setPendingOrder((prev) => {
            if (!prev || prev.confirmed) return prev;

            const nextSide = prev.side === "long" ? "short" : "long"; // <--- changed

            return {
                ...prev,
                side: nextSide,
                showControls: true,
                controlsOpacity: 1,
            };
        });

        setTakeProfit(null); // <--- changed
        setStopLoss(null); // <--- changed
    }

    function startPendingSideSwipe() {
        stopPendingSideSwipe(); // <--- changed
        cyclePendingOrderSideOnce(); // <--- changed: regular click cycles once immediately

        pendingSideSwipeTimerRef.current = window.setInterval(() => {
            cyclePendingOrderSideOnce(); // <--- changed: holding continues cycling
        }, 350); // <--- changed
    }

    function handlePendingOrderButton() {
        if (!canPlaceTrade()) return; // <--- changed

        if (pendingOrder) {
            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: true,
                        controlsOpacity: 1,
                        armedForFill: false, // <--- changed
                    }
                    : prev
            );
            return;
        }

        const startingPrice = price + 0.05;

        setPendingOrder({
            price: startingPrice,
            side: getPendingSide(startingPrice),
            quantity: Math.max(1, quantity || 1),
            confirmed: false,
            showControls: true,
            controlsOpacity: 1, // <--- added
            hideCheckWhenConfirmed: false, // <--- changed
            reopenedTrashOnly: false, // <--- changed
            armedForFill: false, // <--- changed
        });
    }

    function confirmPendingOrder() {
        stopPendingSideSwipe(); // <--- changed

        setPendingOrder((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                quantity: Math.max(1, quantity || 1),
                confirmed: true,
                showControls: false, // <--- changed: fade starts immediately
                controlsOpacity: 0, // <--- changed: fade starts immediately
                hideCheckWhenConfirmed: true, // <--- changed
                reopenedTrashOnly: false, // <--- changed
                armedForFill: false, // <--- changed
            };
        });
    }

    function deletePendingSetup() {
        stopPendingSideSwipe(); // <--- changed
        setPendingOrder(null); // <--- changed
        setTakeProfit(null); // <--- changed
        setStopLoss(null); // <--- changed
        draggingPendingRef.current = false; // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        trailingStopModeRef.current = false; // <--- changed
        dragModeRef.current = null; // <--- changed
    }

    function getCanvasPoint(event: ReactMouseEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();

        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    function confirmExitLines() {
        setPendingOrder((prev) =>
            prev
                ? {
                    ...prev,
                    showControls: true,
                    controlsOpacity: 1,
                }
                : prev
        );

        window.setTimeout(() => {
            setPendingOrder((prev) =>
                prev && prev.confirmed
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );
        }, 450);
    }

    function hidePositionControls() {
        setShowPositionControls(false); // <--- changed
        setPositionControlsOpacity(0); // <--- changed
    }

    function showPositionControlsNow() {
        setShowPositionControls(true); // <--- changed
        setPositionControlsOpacity(1); // <--- changed
    }

    function deleteLivePositionSetup() {
        handleClosePosition(); // <--- changed: trash on live position closes order and realizes P/L
        dragModeRef.current = null; // <--- changed
        createExitMovedRef.current = false; // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        trailingStopModeRef.current = false; // <--- changed
    }

    function getCanvasTouchPoint(event: ReactTouchEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return null;

        const rect = canvas.getBoundingClientRect();

        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        };
    }

    function isInsideHitBox(point: { x: number; y: number }, box: HitBox | null) {
        if (!box) return false;

        return (
            point.x >= box.x &&
            point.x <= box.x + box.w &&
            point.y >= box.y &&
            point.y <= box.y + box.h
        );
    }

    function shouldIgnoreMouseAfterTouch() {
        return Date.now() - lastTouchActionTimeRef.current < 650; // <--- changed
    }

    function handleChartMouseDown(event: ReactMouseEvent<HTMLCanvasElement>) {
        if (shouldIgnoreMouseAfterTouch()) return; // <--- changed

        const point = getCanvasPoint(event);
        if (!point) return;

        if (takeProfit && isInsideHitBox(point, tpTrashHitBoxRef.current)) {
            setTakeProfit(null);
            return;
        }

        if (stopLoss && isInsideHitBox(point, slTrashHitBoxRef.current)) {
            setStopLoss(null);
            return;
        }

        if (pendingOrder) {
            if (isInsideHitBox(point, pendingCheckHitBoxRef.current)) {
                if (pendingOrder.confirmed) {
                    confirmExitLines();
                } else {
                    confirmPendingOrder();
                }
                return;
            }

            if (isInsideHitBox(point, pendingTrashHitBoxRef.current)) {
                deletePendingSetup();
                return;
            }

            if (!pendingOrder.confirmed && isInsideHitBox(point, pendingLeftArrowHitBoxRef.current)) {
                startPendingSideSwipe();
                return;
            }

            if (!pendingOrder.confirmed && isInsideHitBox(point, pendingRightArrowHitBoxRef.current)) {
                startPendingSideSwipe();
                return;
            }
        }

        if (position && isInsideHitBox(point, positionTrashHitBoxRef.current)) {
            deleteLivePositionSetup();
            return;
        }

        const metrics = chartMetricsRef.current;
        if (!metrics) return;

        const getLineY = (linePrice: number) =>
            40 +
            ((metrics.paddedHighest - linePrice) / metrics.paddedRange) *
            (metrics.height - 90);

        const nearTp =
            takeProfit && Math.abs(point.y - getLineY(takeProfit.price)) <= 16;

        const nearSl =
            stopLoss && Math.abs(point.y - getLineY(stopLoss.price)) <= 16;

        if (nearTp) {
            dragModeRef.current = "tp";
            isDraggingExitLineRef.current = true; // <--- changed

            setTakeProfit((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: true,
                    }
                    : prev
            );

            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: false,
                    }
                    : prev
            );

            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );

            hidePositionControls();

            return;
        }

        if (nearSl) {
            dragModeRef.current = "sl";
            isDraggingExitLineRef.current = true; // <--- changed
            if (position && stopLoss?.active === false) {
                trailingStopModeRef.current = true; // <--- changed
            }

            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: true,
                    }
                    : prev
            );

            setTakeProfit((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: false,
                    }
                    : prev
            );

            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );

            hidePositionControls();

            return;
        }

        if (pendingOrder) {
            const pendingY = getLineY(pendingOrder.price);
            const nearPendingLine = Math.abs(point.y - pendingY) <= 16;

            if (nearPendingLine) {
                if (pendingOrder.confirmed) {
                    dragModeRef.current = "create-exit";
                    createExitMovedRef.current = false;
                    isDraggingExitLineRef.current = true; // <--- changed

                    setPendingOrder((prev) =>
                        prev
                            ? {
                                ...prev,
                                showControls: false,
                                controlsOpacity: 0,
                            }
                            : prev
                    );

                    setTakeProfit((prev) =>
                        prev
                            ? {
                                ...prev,
                                showTrash: false,
                            }
                            : prev
                    );

                    setStopLoss((prev) =>
                        prev
                            ? {
                                ...prev,
                                showTrash: false,
                            }
                            : prev
                    );

                    return;
                }

                dragModeRef.current = "pending";
                draggingPendingRef.current = true;

                setPendingOrder((prev) =>
                    prev
                        ? {
                            ...prev,
                            showControls: true,
                            controlsOpacity: 1,
                        }
                        : prev
                );

                return;
            }
        }

        if (position) {
            const entryY = getLineY(position.entry);
            const nearPositionLine = Math.abs(point.y - entryY) <= 16;

            if (nearPositionLine) {
                dragModeRef.current = "create-exit";
                createExitMovedRef.current = false;
                isDraggingExitLineRef.current = true; // <--- changed
                hidePositionControls();

                setTakeProfit((prev) =>
                    prev
                        ? {
                            ...prev,
                            showTrash: false,
                        }
                        : prev
                );

                setStopLoss((prev) =>
                    prev
                        ? {
                            ...prev,
                            showTrash: false,
                        }
                        : prev
                );

                return;
            }
        }

        setPendingOrder((prev) =>
            prev && prev.confirmed
                ? {
                    ...prev,
                    showControls: false,
                    controlsOpacity: 0,
                }
                : prev
        );

        hidePositionControls();

        setTakeProfit((prev) =>
            prev
                ? {
                    ...prev,
                    showTrash: false,
                }
                : prev
        );

        setStopLoss((prev) =>
            prev
                ? {
                    ...prev,
                    showTrash: false,
                }
                : prev
        );
    }

    function handleChartMouseMove(event: ReactMouseEvent<HTMLCanvasElement>) {
        if (shouldIgnoreMouseAfterTouch()) return; // <--- changed

        const point = getCanvasPoint(event);
        if (!point) return;

        const newPrice = canvasYToPrice(point.y);
        const mode = dragModeRef.current;
        const entryPrice = pendingOrder?.price ?? position?.entry ?? price;
        const activeSide = pendingOrder?.side ?? position?.side ?? "long"; // <--- changed

        if (mode === "pending" && pendingOrder) {
            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        price: newPrice, // <--- changed: pending line moves freely above/below current price
                        side: getPendingSide(newPrice), // <--- changed: auto switches Buy Stop/Sell Stop while dragging
                        confirmed: false,
                        showControls: true,
                        controlsOpacity: 1,
                    }
                    : prev
            );

            return;
        }

        if (mode === "create-exit" && (pendingOrder?.confirmed || position)) {
            createExitMovedRef.current = true; // <--- changed

            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );
            hidePositionControls(); // <--- changed

            const activeEntry = pendingOrder?.price ?? position?.entry ?? price; // <--- changed
            const activeTradeSide = pendingOrder?.side ?? position?.side ?? "long"; // <--- changed
            const alreadyHasExitLine = !!takeProfit || !!stopLoss; // <--- changed

            if (!alreadyHasExitLine) {
                setSingleDraftExitLine(newPrice, activeEntry, activeTradeSide); // <--- changed
                return;
            }

            if (takeProfit && !stopLoss) {
                const secondPrice =
                    activeTradeSide === "long"
                        ? Math.min(newPrice, activeEntry)
                        : Math.max(newPrice, activeEntry); // <--- changed

                setStopLoss({
                    price: secondPrice,
                    kind: "sl",
                    showTrash: false,
                    active: true, // <--- changed
                });

                dragModeRef.current = "sl";
                return;
            }

            if (stopLoss && !takeProfit) {
                const secondPrice =
                    activeTradeSide === "long"
                        ? Math.max(newPrice, activeEntry)
                        : Math.min(newPrice, activeEntry); // <--- changed

                setTakeProfit({
                    price: secondPrice,
                    kind: "tp",
                    showTrash: false,
                    active: true, // <--- changed
                });

                dragModeRef.current = "tp";
                return;
            }

            return;
        }

        if (mode === "tp" && takeProfit) {
            if (!stopLoss) {
                setSingleDraftExitLine(newPrice, entryPrice, activeSide); // <--- changed: first dragged line can flip above/below
                return;
            }

            const clampedPrice =
                activeSide === "long"
                    ? Math.max(newPrice, entryPrice)
                    : Math.min(newPrice, entryPrice); // <--- changed

            setTakeProfit((prev) =>
                prev
                    ? {
                        ...prev,
                        price: clampedPrice,
                    }
                    : prev
            );

            return;
        }

        if (mode === "sl" && stopLoss) {
            if (trailingStopModeRef.current && position) {
                setStopLoss((prev) =>
                    prev
                        ? {
                            ...prev,
                            price: newPrice, // <--- changed: allow profit side or drawdown side
                            active: false, // <--- changed: stays inactive while dragging
                        }
                        : prev
                );

                return;
            }

            if (!takeProfit) {
                setSingleDraftExitLine(newPrice, entryPrice, activeSide); // <--- changed: first dragged line can flip above/below
                return;
            }

            const clampedPrice =
                activeSide === "long"
                    ? Math.min(newPrice, entryPrice)
                    : Math.max(newPrice, entryPrice); // <--- changed

            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        price: clampedPrice,
                    }
                    : prev
            );
        }
    }

    function handleChartMouseUp() {
        if (shouldIgnoreMouseAfterTouch()) return; // <--- changed

        stopPendingSideSwipe(); // <--- changed

        if (dragModeRef.current === "create-exit" && !createExitMovedRef.current) {
            setPendingOrder((prev) =>
                prev && prev.confirmed
                    ? {
                        ...prev,
                        showControls: true, // <--- changed: only a click on blue line shows controls
                        controlsOpacity: 1,
                        reopenedTrashOnly: true, // <--- changed
                    }
                    : prev
            );

            if (position) {
                showPositionControlsNow(); // <--- changed: click live entry line shows live controls
            }
        }

        if (
            trailingStopModeRef.current &&
            stopLoss &&
            isDraggingExitLineRef.current &&
            position &&
            isPositionInProfit(position)
        ) {
            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        active: true, // <--- changed: trailing stop becomes active only after drag release while in profit
                    }
                    : prev
            );
        } else if (trailingStopModeRef.current && stopLoss?.active === false) {
            setStopLoss(null); // <--- changed: remove inactive draft if not valid/in profit
        }

        if (
            trailingStopModeRef.current &&
            stopLoss &&
            isDraggingExitLineRef.current &&
            position &&
            isPositionInProfit(position)
        ) {
            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        active: true, // <--- changed: trailing stop becomes active only after drag release while in profit
                    }
                    : prev
            );
        } else if (trailingStopModeRef.current && stopLoss?.active === false) {
            setStopLoss(null); // <--- changed: remove inactive draft if not valid/in profit
        }

        draggingPendingRef.current = false;
        createExitMovedRef.current = false; // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        trailingStopModeRef.current = false; // <--- changed
        dragModeRef.current = null;
    }

    function handleChartMouseLeave() {
        stopPendingSideSwipe(); // <--- changed
        draggingPendingRef.current = false;
        createExitMovedRef.current = false; // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        trailingStopModeRef.current = false; // <--- changed
        dragModeRef.current = null; // <--- changed

        setPendingOrder((prev) =>
            prev && prev.confirmed
                ? {
                    ...prev,
                    showControls: false,
                    controlsOpacity: 0,
                }
                : prev
        );
    }

    function handleChartTouchStart(event: ReactTouchEvent<HTMLCanvasElement>) {
        event.preventDefault();
        lastTouchActionTimeRef.current = Date.now(); // <--- changed

        const point = getCanvasTouchPoint(event);
        if (!point) return;

        if (takeProfit && isInsideHitBox(point, tpTrashHitBoxRef.current)) {
            setTakeProfit(null);
            return;
        }

        if (stopLoss && isInsideHitBox(point, slTrashHitBoxRef.current)) {
            setStopLoss(null);
            return;
        }

        if (pendingOrder) {
            if (isInsideHitBox(point, pendingCheckHitBoxRef.current)) {
                if (pendingOrder.confirmed) {
                    confirmExitLines();
                } else {
                    confirmPendingOrder();
                }
                return;
            }

            if (isInsideHitBox(point, pendingTrashHitBoxRef.current)) {
                deletePendingSetup();
                return;
            }

            if (!pendingOrder.confirmed && isInsideHitBox(point, pendingLeftArrowHitBoxRef.current)) {
                startPendingSideSwipe();
                return;
            }

            if (!pendingOrder.confirmed && isInsideHitBox(point, pendingRightArrowHitBoxRef.current)) {
                startPendingSideSwipe();
                return;
            }
        }

        if (position && isInsideHitBox(point, positionTrashHitBoxRef.current)) {
            deleteLivePositionSetup();
            return;
        }

        const metrics = chartMetricsRef.current;
        if (!metrics) return;

        const getLineY = (linePrice: number) =>
            40 +
            ((metrics.paddedHighest - linePrice) / metrics.paddedRange) *
            (metrics.height - 90);

        const nearTp =
            takeProfit && Math.abs(point.y - getLineY(takeProfit.price)) <= 22;

        const nearSl =
            stopLoss && Math.abs(point.y - getLineY(stopLoss.price)) <= 22;

        if (nearTp) {
            dragModeRef.current = "tp";
            isDraggingExitLineRef.current = true; // <--- changed

            setTakeProfit((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: true,
                    }
                    : prev
            );

            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: false,
                    }
                    : prev
            );

            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );

            hidePositionControls();

            return;
        }

        if (nearSl) {
            dragModeRef.current = "sl";
            isDraggingExitLineRef.current = true; // <--- changed
            if (position && stopLoss?.active === false) {
                trailingStopModeRef.current = true; // <--- changed
            }

            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: true,
                    }
                    : prev
            );

            setTakeProfit((prev) =>
                prev
                    ? {
                        ...prev,
                        showTrash: false,
                    }
                    : prev
            );

            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );

            hidePositionControls();

            return;
        }

        if (pendingOrder) {
            const pendingY = getLineY(pendingOrder.price);
            const nearPendingLine = Math.abs(point.y - pendingY) <= 22;

            if (nearPendingLine) {
                if (pendingOrder.confirmed) {
                    dragModeRef.current = "create-exit";
                    createExitMovedRef.current = false;
                    isDraggingExitLineRef.current = true; // <--- changed

                    setPendingOrder((prev) =>
                        prev
                            ? {
                                ...prev,
                                showControls: false,
                                controlsOpacity: 0,
                            }
                            : prev
                    );

                    setTakeProfit((prev) =>
                        prev
                            ? {
                                ...prev,
                                showTrash: false,
                            }
                            : prev
                    );

                    setStopLoss((prev) =>
                        prev
                            ? {
                                ...prev,
                                showTrash: false,
                            }
                            : prev
                    );

                    return;
                }

                dragModeRef.current = "pending";
                draggingPendingRef.current = true;

                setPendingOrder((prev) =>
                    prev
                        ? {
                            ...prev,
                            showControls: true,
                            controlsOpacity: 1,
                        }
                        : prev
                );

                return;
            }
        }

        if (position) {
            const entryY = getLineY(position.entry);
            const nearPositionLine = Math.abs(point.y - entryY) <= 22;

            if (nearPositionLine) {
                dragModeRef.current = "create-exit";
                createExitMovedRef.current = false;
                isDraggingExitLineRef.current = true; // <--- changed
                hidePositionControls();

                setTakeProfit((prev) =>
                    prev
                        ? {
                            ...prev,
                            showTrash: false,
                        }
                        : prev
                );

                setStopLoss((prev) =>
                    prev
                        ? {
                            ...prev,
                            showTrash: false,
                        }
                        : prev
                );

                return;
            }
        }

        setPendingOrder((prev) =>
            prev && prev.confirmed
                ? {
                    ...prev,
                    showControls: false,
                    controlsOpacity: 0,
                }
                : prev
        );

        hidePositionControls();

        setTakeProfit((prev) =>
            prev
                ? {
                    ...prev,
                    showTrash: false,
                }
                : prev
        );

        setStopLoss((prev) =>
            prev
                ? {
                    ...prev,
                    showTrash: false,
                }
                : prev
        );
    }

    function handleChartTouchMove(event: ReactTouchEvent<HTMLCanvasElement>) {
        event.preventDefault();
        lastTouchActionTimeRef.current = Date.now(); // <--- changed

        const point = getCanvasTouchPoint(event);
        if (!point) return;

        const newPrice = canvasYToPrice(point.y);
        const mode = dragModeRef.current;
        const entryPrice = pendingOrder?.price ?? position?.entry ?? price;
        const activeSide = pendingOrder?.side ?? position?.side ?? "long"; // <--- changed

        if (mode === "pending" && pendingOrder) {
            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        price: newPrice, // <--- changed: pending line moves freely above/below current price
                        side: getPendingSide(newPrice), // <--- changed: auto switches Buy Stop/Sell Stop while dragging
                        confirmed: false,
                        showControls: true,
                        controlsOpacity: 1,
                    }
                    : prev
            );

            return;
        }

        if (mode === "create-exit" && (pendingOrder?.confirmed || position)) {
            createExitMovedRef.current = true; // <--- changed

            setPendingOrder((prev) =>
                prev
                    ? {
                        ...prev,
                        showControls: false,
                        controlsOpacity: 0,
                    }
                    : prev
            );
            hidePositionControls(); // <--- changed

            const activeEntry = pendingOrder?.price ?? position?.entry ?? price; // <--- changed
            const activeTradeSide = pendingOrder?.side ?? position?.side ?? "long"; // <--- changed
            const alreadyHasExitLine = !!takeProfit || !!stopLoss; // <--- changed

            if (!alreadyHasExitLine) {
                setSingleDraftExitLine(newPrice, activeEntry, activeTradeSide); // <--- changed
                return;
            }

            if (takeProfit && !stopLoss) {
                const secondPrice =
                    activeTradeSide === "long"
                        ? Math.min(newPrice, activeEntry)
                        : Math.max(newPrice, activeEntry); // <--- changed

                setStopLoss({
                    price: secondPrice,
                    kind: "sl",
                    showTrash: false,
                    active: true, // <--- changed
                });

                dragModeRef.current = "sl";
                return;
            }

            if (stopLoss && !takeProfit) {
                const secondPrice =
                    activeTradeSide === "long"
                        ? Math.max(newPrice, activeEntry)
                        : Math.min(newPrice, activeEntry); // <--- changed

                setTakeProfit({
                    price: secondPrice,
                    kind: "tp",
                    showTrash: false,
                    active: true, // <--- changed
                });

                dragModeRef.current = "tp";
                return;
            }

            return;
        }

        if (mode === "tp" && takeProfit) {
            if (!stopLoss) {
                setSingleDraftExitLine(newPrice, entryPrice, activeSide); // <--- changed: first dragged line can flip above/below
                return;
            }

            const clampedPrice =
                activeSide === "long"
                    ? Math.max(newPrice, entryPrice)
                    : Math.min(newPrice, entryPrice); // <--- changed

            setTakeProfit((prev) =>
                prev
                    ? {
                        ...prev,
                        price: clampedPrice,
                    }
                    : prev
            );

            return;
        }

        if (mode === "sl" && stopLoss) {
            if (trailingStopModeRef.current && position) {
                setStopLoss((prev) =>
                    prev
                        ? {
                            ...prev,
                            price: newPrice, // <--- changed: allow profit side or drawdown side
                            active: false, // <--- changed: stays inactive while dragging
                        }
                        : prev
                );

                return;
            }

            if (!takeProfit) {
                setSingleDraftExitLine(newPrice, entryPrice, activeSide); // <--- changed: first dragged line can flip above/below
                return;
            }

            const clampedPrice =
                activeSide === "long"
                    ? Math.min(newPrice, entryPrice)
                    : Math.max(newPrice, entryPrice); // <--- changed

            setStopLoss((prev) =>
                prev
                    ? {
                        ...prev,
                        price: clampedPrice,
                    }
                    : prev
            );
        }
    }

    function handleChartTouchEnd() {
        lastTouchActionTimeRef.current = Date.now(); // <--- changed
        stopPendingSideSwipe(); // <--- changed

        if (dragModeRef.current === "create-exit" && !createExitMovedRef.current) {
            setPendingOrder((prev) =>
                prev && prev.confirmed
                    ? {
                        ...prev,
                        showControls: true, // <--- changed: only a tap on blue line shows controls
                        controlsOpacity: 1,
                        reopenedTrashOnly: true, // <--- changed
                    }
                    : prev
            );

            if (position) {
                showPositionControlsNow(); // <--- changed: tap live entry line shows live controls
            }
        }

        draggingPendingRef.current = false;
        createExitMovedRef.current = false; // <--- changed
        isDraggingExitLineRef.current = false; // <--- changed
        trailingStopModeRef.current = false; // <--- changed
        dragModeRef.current = null;
    }

    useEffect(() => {
        let cancelled = false;

        async function loadCsv() {
            try {
                const response = await fetch(CSV_PATH);

                if (!response.ok) {
                    throw new Error(`Could not load ${CSV_PATH}`);
                }

                const text = await response.text();
                const parsed = parseCsvCandles(text);

                if (parsed.length < 200) {
                    throw new Error(
                        "CSV loaded, but not enough candle rows were found."
                    );
                }

                if (cancelled) return;

                csvCandlesRef.current = parsed;

                const startIndex = Math.floor(randomBetween(0, parsed.length - 1));

                const history = buildContinuousHistory(
                    parsed,
                    startIndex,
                    HISTORY_BASE_CANDLES
                );

                const closedCandles = history.candles;
                const open = history.lastClose;
                const rawNext = parsed[history.nextIndex];
                const activeCandleTimeMs =
                    parseCsvTimestamp(rawNext.time) ??
                    fallbackMarketSessionStartRef.current; // <--- changed

                const planned = createActivePlan(
                    applyRealCandleShape(rawNext, open)
                );

                const activeCandle: Candle = {
                    open: planned.open,
                    high: planned.open,
                    low: planned.open,
                    close: planned.open,
                };

                appStartRef.current = Date.now();
                setPrice(activeCandle.close);

                setMarket({
                    loaded: true,
                    status: `Loaded ${parsed.length.toLocaleString()} XAGUSD 15m candles`,
                    closedCandles,
                    activeCandle,
                    plannedCandle: planned,
                    dataIndex: history.nextIndex,
                    active15mIndex: 0,
                    activeCandleTimeMs, // <--- changed
                });
            } catch (error) {
                console.error(error);

                const parsed = fallbackCandles();
                csvCandlesRef.current = parsed;

                const history = buildContinuousHistory(
                    parsed,
                    0,
                    HISTORY_BASE_CANDLES
                );

                const closedCandles = history.candles;
                const open = history.lastClose;
                const activeCandleTimeMs =
                    parseCsvTimestamp(parsed[history.nextIndex].time) ??
                    fallbackMarketSessionStartRef.current; // <--- changed

                const planned = createActivePlan(
                    applyRealCandleShape(parsed[history.nextIndex], open)
                );

                const activeCandle: Candle = {
                    open: planned.open,
                    high: planned.open,
                    low: planned.open,
                    close: planned.open,
                };

                appStartRef.current = Date.now();
                setPrice(activeCandle.close);

                setMarket({
                    loaded: true,
                    status: "CSV not found. Using fallback candles.",
                    closedCandles,
                    activeCandle,
                    plannedCandle: planned,
                    dataIndex: history.nextIndex,
                    active15mIndex: 0,
                    activeCandleTimeMs, // <--- changed
                });
            }
        }

        loadCsv();

        return () => {
            cancelled = true;
        };
    }, []);

    const allCandles = useMemo(() => {
        return [...market.closedCandles, market.activeCandle];
    }, [market.closedCandles, market.activeCandle]);
    const base15mMs = TIMEFRAME_SECONDS["15m"] * 1000;
    const currentPauseDuration =
        simulationPaused && pauseStartedAtRef.current !== null
            ? now - pauseStartedAtRef.current
            : 0; // <--- changed

    const elapsedInsideCurrent15m = Math.max(
        0,
        now - appStartRef.current - totalPausedMsRef.current - currentPauseDuration
    ); // <--- changed

    const currentMarketTimestamp = getAlignedMarketDisplayTimestamp(
        market.activeCandleTimeMs ?? fallbackMarketSessionStartRef.current,
        Math.max(0, elapsedInsideCurrent15m)
    ); // <--- changed: always uses the CSV candle time plus live candle progress

    const remainingRealMarketSeconds = getRealSecondsUntilTimeframeClose(
        currentMarketTimestamp,
        timeframe
    ); // <--- changed

    const remainingMs = convertRealMarketSecondsToSimMs(
        remainingRealMarketSeconds
    ); // <--- changed: countdown aligns to actual CSV market-time boundary

    const countdownText = formatCountdown(
        Math.ceil(Math.max(0, remainingMs) / 1000)
    );

    const marketDateTimeText = formatMarketDateTime(currentMarketTimestamp); // <--- changed
    const marketSessionText = `${getMarketSessionName(currentMarketTimestamp)} Session`; // <--- changed

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now()); // <--- changed: keep UI clock alive; countdown is frozen by pause math
        }, 250);

        return () => clearInterval(timer);
    }, [simulationPaused]);

    useEffect(() => {
        const preventContextMenu = (event: Event) => event.preventDefault();

        const updateOrientationState = () => {
            setIsLandscape(window.innerWidth > window.innerHeight); // <--- changed
        };

        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.userSelect = "none";
        document.body.style.webkitUserSelect = "none";
        document.body.style.setProperty("-webkit-tap-highlight-color", "transparent"); // <--- changed

        window.addEventListener("contextmenu", preventContextMenu);
        window.addEventListener("resize", updateOrientationState); // <--- changed
        window.addEventListener("orientationchange", updateOrientationState); // <--- changed

        updateOrientationState(); // <--- changed

        if (
            screen.orientation &&
            typeof screen.orientation.lock === "function"
        ) {
            screen.orientation.lock("portrait").catch(() => {
                // Browser may require fullscreen/PWA before real orientation lock works.
            });
        }

        return () => {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
            document.body.style.userSelect = "";
            document.body.style.webkitUserSelect = "";
            document.body.style.removeProperty("-webkit-tap-highlight-color"); // <--- changed
            window.removeEventListener("contextmenu", preventContextMenu);
            window.removeEventListener("resize", updateOrientationState); // <--- changed
            window.removeEventListener("orientationchange", updateOrientationState); // <--- changed
        };
    }, []);


    useEffect(() => {
        return () => stopPendingSideSwipe(); // <--- changed
    }, []);

    useEffect(() => {
        const tickInterval = setInterval(() => {
            if (simulationPausedRef.current) return; // <--- changed

            setMarket((prev) => {
                if (!prev.loaded || !prev.plannedCandle) return prev;

                const elapsed = getSimElapsedMs(); // <--- changed
                const progress = clamp(elapsed / base15mMs, 0, 1);

                const calculated = candleFromPlanAtProgress(
                    prev.plannedCandle,
                    progress
                );

                const active: Candle = {
                    open: prev.activeCandle.open,
                    close: calculated.close,
                    high: Math.max(prev.activeCandle.high, calculated.high),
                    low: Math.min(prev.activeCandle.low, calculated.low),
                };

                setPrice(active.close);

                return {
                    ...prev,
                    activeCandle: active,
                };
            });
        }, 120);

        return () => clearInterval(tickInterval);
    }, [base15mMs]);

    useEffect(() => {
        const closeInterval = setInterval(() => {
            if (simulationPausedRef.current) return; // <--- changed

            const elapsed = getSimElapsedMs(); // <--- changed
            if (elapsed < TIMEFRAME_SECONDS["15m"] * 1000) return; // <--- changed

            setMarket((prev) => {
                if (!prev.loaded || !prev.plannedCandle) return prev;

                const data = csvCandlesRef.current;
                if (data.length === 0) return prev;

                const finished: Candle = {
                    open: prev.plannedCandle.open,
                    high: Math.max(
                        prev.activeCandle.high,
                        prev.plannedCandle.high
                    ),
                    low: Math.min(
                        prev.activeCandle.low,
                        prev.plannedCandle.low
                    ),
                    close: prev.plannedCandle.close,
                };

                const closedCandles = [...prev.closedCandles, finished];

                if (closedCandles.length > MAX_BASE_CANDLES) {
                    closedCandles.splice(0, TRIM_BASE_CANDLES);
                }

                let nextIndex = prev.dataIndex + 1;

                if (nextIndex >= data.length) {
                    nextIndex = 0;
                }

                const nextRaw = data[nextIndex];
                const nextCandleTimeMs =
                    parseCsvTimestamp(nextRaw.time) ??
                    ((prev.activeCandleTimeMs ?? fallbackMarketSessionStartRef.current) +
                        15 * 60 * 1000); // <--- changed

                const nextPlan = createActivePlan(
                    applyRealCandleShape(nextRaw, finished.close)
                );

                const newActive: Candle = {
                    open: nextPlan.open,
                    high: nextPlan.open,
                    low: nextPlan.open,
                    close: nextPlan.open,
                };

                setPrice(newActive.close);

                appStartRef.current = Date.now(); // <--- changed
                totalPausedMsRef.current = 0; // <--- changed
                pauseStartedAtRef.current = null; // <--- changed

                return {
                    loaded: true,
                    status: prev.status,
                    closedCandles,
                    activeCandle: newActive,
                    plannedCandle: nextPlan,
                    dataIndex: nextIndex,
                    active15mIndex: prev.active15mIndex + 1,
                    activeCandleTimeMs: nextCandleTimeMs, // <--- changed
                };
            });
        }, 120); // <--- changed

        return () => clearInterval(closeInterval);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const ctx: CanvasRenderingContext2D = context;

        const width = parent.clientWidth;
        const height = parent.clientHeight;

        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(
            window.devicePixelRatio,
            0,
            0,
            window.devicePixelRatio,
            0,
            0
        );

        ctx.clearRect(0, 0, width, height);

        if (!market.loaded || allCandles.length < 5) {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "bold 18px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(market.status, width / 2, height / 2);
            return;
        }

        const timeframeCandles = aggregateCandles(
            allCandles,
            timeframe,
            market.active15mIndex
        );

        const candleWidth =
            timeframe === "Daily" ? 12 :
                timeframe === "4h" ? 11 :
                    timeframe === "1h" ? 10 :
                        timeframe === "30m" ? 9 :
                            8;

        const gap =
            timeframe === "Daily" ? 8 :
                timeframe === "4h" ? 7 :
                    timeframe === "1h" ? 6 :
                        timeframe === "30m" ? 5 :
                            5;

        const priceLabelWidth = 82;
        const priceLabelHeight = 42;
        const priceLabelRight = 8;
        const candleToLabelGap = 24;

        const leftPad = 18;
        const rightGap = priceLabelWidth + priceLabelRight + candleToLabelGap;
        const candleStep = candleWidth + gap;

        const maxCandlesThatFit = Math.max(
            8,
            Math.floor((width - leftPad - rightGap + candleStep) / candleStep)
        );

        const visible = timeframeCandles.slice(-maxCandlesThatFit);

        if (visible.length === 0) return;

        const highest = Math.max(...visible.map((c) => c.high));
        const lowest = Math.min(...visible.map((c) => c.low));
        const rawRange = highest - lowest || 1;
        const paddedHighest = highest + rawRange * 0.08;
        const paddedLowest = lowest - rawRange * 0.08;
        const paddedRange = paddedHighest - paddedLowest || 1;

        const priceToY = (p: number) => {
            return 40 + ((paddedHighest - p) / paddedRange) * (height - 90);
        };

        chartMetricsRef.current = {
            width,
            height,
            paddedHighest,
            paddedLowest,
            paddedRange,
        };

        const totalCandleWidth = visible.length * candleStep - gap;

        const startX = Math.max(
            leftPad,
            width - rightGap - totalCandleWidth
        );

        pendingCheckHitBoxRef.current = null;
        pendingTrashHitBoxRef.current = null;
        pendingLeftArrowHitBoxRef.current = null; // <--- changed
        pendingRightArrowHitBoxRef.current = null; // <--- changed
        positionTrashHitBoxRef.current = null; // <--- changed
        tpTrashHitBoxRef.current = null;
        slTrashHitBoxRef.current = null;

        function drawAlternatingDashedHorizontalLine(
            lineY: number,
            color: string,
            lightColor: string
        ) {
            const dashLength = 10;
            const gapLength = 6;
            let x = 0;
            let dashIndex = 0;

            ctx.lineWidth = 2;
            ctx.setLineDash([]);

            while (x < width) {
                const dashEnd = Math.min(x + dashLength, width);

                ctx.strokeStyle = dashIndex % 2 === 0 ? color : lightColor; // <--- changed
                ctx.beginPath();
                ctx.moveTo(x, lineY);
                ctx.lineTo(dashEnd, lineY);
                ctx.stroke();

                x += dashLength + gapLength;
                dashIndex += 1;
            }
        }

        function drawExitLine(line: ExitLine, drawMode: "line" | "label" = "line") {
            const lineY = priceToY(line.price);
            const isTp = line.kind === "tp";
            const entryPrice = pendingOrder?.price ?? position?.entry ?? price;
            const qty = pendingOrder?.quantity ?? position?.quantity ?? quantity;
            const side = pendingOrder?.side ?? position?.side ?? "long"; // <--- changed
            const projectedPnl = calculateProjectedPnl(line.price, entryPrice, qty, side);
            const color = isTp || projectedPnl >= 0 ? GREEN : RED; // <--- changed
            const lineColor = isTp ? DIM_GREEN_LINE : DIM_RED_LINE; // <--- changed
            const lightLineColor = isTp ? LIGHT_GREEN_LINE : LIGHT_RED_LINE; // <--- changed

            if (drawMode === "line") {
                drawAlternatingDashedHorizontalLine(lineY, lineColor, lightLineColor); // <--- changed
                return;
            }

            const pnlText = formatMoney(projectedPnl);
            const entryY = priceToY(entryPrice); // <--- changed
            const lineIsAboveEntry = lineY < entryY; // <--- changed
            const pnlY = lineIsAboveEntry ? lineY - 13 : lineY + 13; // <--- changed: top line label above, bottom line label below

            ctx.font = "bold 13px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.lineWidth = 5;
            ctx.strokeStyle = "#ffffff";
            ctx.strokeText(pnlText, width / 2, pnlY);

            ctx.fillStyle = color;
            ctx.fillText(pnlText, width / 2, pnlY);

            if (line.showTrash) {
                const buttonSize = 22;
                const buttonX = 14;
                const buttonY = lineY - buttonSize / 2;

                const trashBox: HitBox = {
                    x: buttonX,
                    y: buttonY,
                    w: buttonSize,
                    h: buttonSize,
                };

                if (isTp) {
                    tpTrashHitBoxRef.current = trashBox;
                } else {
                    slTrashHitBoxRef.current = trashBox;
                }

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.roundRect(trashBox.x, trashBox.y, trashBox.w, trashBox.h, 5);
                ctx.fill();

                ctx.fillStyle = "#111111";
                ctx.font = "bold 20px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    "×",
                    trashBox.x + trashBox.w / 2,
                    trashBox.y + trashBox.h / 2 - 1
                );
            }
        }

        // <--- changed: draw all dashed trade lines behind candles
        if (position) {
            const entryY = priceToY(position.entry);

            drawAlternatingDashedHorizontalLine(entryY, DIM_ENTRY_LINE, LIGHT_ENTRY_LINE);
        }

        if (pendingOrder) {
            const pendingY = priceToY(pendingOrder.price);

            drawAlternatingDashedHorizontalLine(pendingY, DIM_BLUE_LINE, LIGHT_BLUE_LINE);
        }

        if (takeProfit) {
            drawExitLine(takeProfit, "line");
        }

        if (stopLoss) {
            drawExitLine(stopLoss, "line");
        }

        // <--- changed: current price line now renders behind candles
        const backgroundPriceY = priceToY(price);

        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, backgroundPriceY);
        ctx.lineTo(width, backgroundPriceY);
        ctx.stroke();
        ctx.setLineDash([]);

        visible.forEach((c, i) => {
            const x = startX + i * candleStep;
            const color = c.close >= c.open ? bullCandleColor : bearCandleColor; // <--- changed

            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(x + candleWidth / 2, highY);
            ctx.lineTo(x + candleWidth / 2, lowY);
            ctx.stroke();

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

            ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
        });

        // <--- changed: draw TP/SL labels/buttons after candles while dashed lines stay behind candles
        if (takeProfit) {
            drawExitLine(takeProfit, "label");
        }

        if (stopLoss) {
            drawExitLine(stopLoss, "label");
        }

        function drawBlueLineControls() {
            if (!pendingOrder) return;

            const pendingY = priceToY(pendingOrder.price);

            const buttonSize = 22;
            const buttonGap = 6;
            const buttonX = 14;
            const buttonY = pendingY - buttonSize / 2;

            const shouldHideCheck =
                pendingOrder.confirmed &&
                pendingOrder.hideCheckWhenConfirmed &&
                pendingOrder.reopenedTrashOnly; // <--- changed: hide check only when trash is reopened later

            const checkBox: HitBox = {
                x: buttonX,
                y: buttonY,
                w: buttonSize,
                h: buttonSize,
            };

            const confirmedControlsFullyHidden =
                pendingOrder.confirmed &&
                pendingOrder.hideCheckWhenConfirmed &&
                !pendingOrder.showControls &&
                pendingOrder.controlsOpacity <= 0; // <--- changed

            const trashShouldMoveLeft =
                shouldHideCheck &&
                (confirmedControlsFullyHidden || pendingOrder.reopenedTrashOnly); // <--- changed

            const trashBox: HitBox = {
                x: trashShouldMoveLeft ? buttonX : buttonX + buttonSize + buttonGap, // <--- changed
                y: buttonY,
                w: buttonSize,
                h: buttonSize,
            };

            const controlsOpacity = pendingOrder.confirmed
                ? pendingOrder.controlsOpacity
                : 1;

            const controlsAreVisible =
                pendingOrder.showControls || controlsOpacity > 0; // <--- changed

            pendingCheckHitBoxRef.current =
                controlsAreVisible && !shouldHideCheck ? checkBox : null; // <--- changed

            pendingTrashHitBoxRef.current =
                controlsAreVisible &&
                    !(shouldHideCheck && !trashShouldMoveLeft && pendingOrder.controlsOpacity > 0)
                    ? trashBox
                    : null; // <--- changed

            if (!pendingOrder.confirmed) {
                const stopLabel = pendingOrder.side === "long" ? "BUY STOP" : "SELL STOP";

                ctx.font = "bold 12px Arial";
                const textWidth = ctx.measureText(stopLabel).width;

                const arrowZoneWidth = 26;
                const pillPadX = 10;
                const pillH = 24;
                const pillW = textWidth + pillPadX * 2 + arrowZoneWidth * 2 + 8;
                const pillX = width / 2 - pillW / 2;
                const pillY = pendingY - pillH / 2;

                const leftArrowBox: HitBox = {
                    x: pillX + 4,
                    y: pillY + 1,
                    w: arrowZoneWidth,
                    h: pillH - 2,
                };

                const rightArrowBox: HitBox = {
                    x: pillX + pillW - arrowZoneWidth - 4,
                    y: pillY + 1,
                    w: arrowZoneWidth,
                    h: pillH - 2,
                };

                pendingLeftArrowHitBoxRef.current = leftArrowBox;
                pendingRightArrowHitBoxRef.current = rightArrowBox;

                ctx.save();

                ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 8);
                ctx.fill();

                ctx.strokeStyle = "rgba(255,255,255,0.22)";
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                // <--- changed: custom drawn arrows instead of emoji glyphs
                function drawArrow(cx: number, cy: number, direction: "left" | "right") {
                    ctx.beginPath();

                    if (direction === "left") {
                        ctx.moveTo(cx + 4, cy - 6);
                        ctx.lineTo(cx - 4, cy);
                        ctx.lineTo(cx + 4, cy + 6);
                    } else {
                        ctx.moveTo(cx - 4, cy - 6);
                        ctx.lineTo(cx + 4, cy);
                        ctx.lineTo(cx - 4, cy + 6);
                    }

                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 2.2;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                    ctx.stroke();
                }

                drawArrow(
                    leftArrowBox.x + leftArrowBox.w / 2,
                    pendingY,
                    "left"
                );

                drawArrow(
                    rightArrowBox.x + rightArrowBox.w / 2,
                    pendingY,
                    "right"
                );

                ctx.font = "bold 12px Arial";
                ctx.fillText(stopLabel, width / 2, pendingY + 1);

                ctx.restore();
            } else {
                pendingLeftArrowHitBoxRef.current = null;
                pendingRightArrowHitBoxRef.current = null;
            }

            if (!pendingOrder.showControls && controlsOpacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = controlsOpacity;

            if (!shouldHideCheck) {
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.roundRect(checkBox.x, checkBox.y, checkBox.w, checkBox.h, 5);
                ctx.fill();

                ctx.fillStyle = "#111111";
                ctx.font = "bold 15px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    "✓",
                    checkBox.x + checkBox.w / 2,
                    checkBox.y + checkBox.h / 2 + 1
                );
            }

            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.roundRect(trashBox.x, trashBox.y, trashBox.w, trashBox.h, 5);
            ctx.fill();

            ctx.fillStyle = "#111111";
            ctx.font = "bold 20px Arial"; // <--- changed: bigger trash icon
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                "×",
                trashBox.x + trashBox.w / 2,
                trashBox.y + trashBox.h / 2 - 1
            );

            ctx.restore();
        }

        function drawPositionControls() {
            if (!position || !showPositionControls || positionControlsOpacity <= 0) return; // <--- changed

            const entryY = priceToY(position.entry);
            const buttonSize = 22;
            const buttonX = 14;
            const buttonY = entryY - buttonSize / 2;

            const trashBox: HitBox = {
                x: buttonX,
                y: buttonY,
                w: buttonSize,
                h: buttonSize,
            };

            positionTrashHitBoxRef.current = trashBox; // <--- changed

            ctx.save();
            ctx.globalAlpha = positionControlsOpacity;

            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.roundRect(trashBox.x, trashBox.y, trashBox.w, trashBox.h, 5);
            ctx.fill();

            ctx.fillStyle = "#111111";
            ctx.font = "bold 20px Arial"; // <--- changed: bigger trash icon
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                "×",
                trashBox.x + trashBox.w / 2,
                trashBox.y + trashBox.h / 2 - 1
            );

            ctx.restore();
        }

        drawBlueLineControls();
        drawPositionControls(); // <--- changed
        const priceY = priceToY(price);

        const labelW = priceLabelWidth;
        const labelH = priceLabelHeight;
        const labelX = width - labelW - priceLabelRight;
        const labelY = priceY - labelH / 2;
        const pointerW = 10;
        const radius = 7;

        // Price label with the point facing LEFT.
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(labelX + pointerW, labelY);
        ctx.lineTo(labelX + labelW - radius, labelY);
        ctx.arcTo(labelX + labelW, labelY, labelX + labelW, labelY + radius, radius);
        ctx.lineTo(labelX + labelW, labelY + labelH - radius);
        ctx.arcTo(
            labelX + labelW,
            labelY + labelH,
            labelX + labelW - radius,
            labelY + labelH,
            radius
        );
        ctx.lineTo(labelX + pointerW, labelY + labelH);
        ctx.lineTo(labelX, labelY + labelH / 2);
        ctx.closePath();
        ctx.fill();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textCenterX = labelX + pointerW + (labelW - pointerW) / 2;

        ctx.fillStyle = "#000";
        ctx.font = "bold 16px Arial"; // price font bigger
        ctx.fillText(toGoldDisplayPrice(price).toFixed(2), textCenterX, labelY + 17);

        ctx.fillStyle = "#555";
        ctx.font = "bold 11px Arial"; // countdown font bigger
        ctx.fillText(countdownText, textCenterX, labelY + 32);
    }, [
        allCandles,
        price,
        timeframe,
        countdownText,
        market.loaded,
        market.status,
        market.active15mIndex,
        position,
        pendingOrder,
        takeProfit,
        stopLoss,
        showPositionControls, // <--- changed
        positionControlsOpacity, // <--- changed
        bullCandleColor, // <--- changed
        bearCandleColor, // <--- changed
    ]);

    return (
        <div style={styles.app}>
            {isLandscape && ( // <--- changed
                <div style={styles.orientationBlocker}>
                    <div style={styles.orientationTitle}>Rotate Back</div>
                    <div style={styles.orientationText}>
                        This game is locked to portrait mode.
                    </div>
                </div>
            )}

            <div style={styles.gameFrame}>
                <div style={styles.topPanel}>
                    <div style={styles.topMetric}> {/* <--- changed */}
                        <div style={styles.label}>BALANCE</div>
                        <div style={styles.value}>
                            ${balance.toLocaleString()}
                        </div>
                    </div>

                    <div style={{ ...styles.topMetric, textAlign: "center", justifySelf: "center", alignItems: "center" }}> {/* <--- changed */}
                        <div style={styles.label}>OPEN P/L</div>
                        <div
                            style={{
                                ...styles.value,
                                color: !position ? "#ffffff" : openPnl >= 0 ? GREEN : RED,
                            }}
                        >
                            {position ? formatMoney(openPnl) : "$0"}
                        </div>

                        <div
                            style={{
                                ...styles.contractCount,
                                visibility: position ? "visible" : "hidden", // <--- changed: keeps space reserved
                            }}
                        >
                            {position
                                ? `${position.quantity.toLocaleString()} ${position.quantity === 1 ? "contract" : "contracts"
                                }`
                                : "contracts"}
                        </div>
                    </div>

                    <div style={{ ...styles.topMetric, textAlign: "right", justifySelf: "end", alignItems: "flex-end" }}> {/* <--- changed */}
                        <div style={styles.label}>TICKER</div>
                        <div style={styles.value}>GOLD</div>
                    </div>
                </div>

                <div style={styles.timeframes}>
                    {["15m", "30m", "1h", "4h", "Daily"]
                        .filter((tf) => visibleTimeframes[tf])
                        .map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                style={
                                    timeframe === tf
                                        ? styles.tfActive
                                        : styles.tfButton
                                }
                            >
                                {tf}
                            </button>
                        ))}
                </div>

                <div style={styles.floatingSettingsWrap}> {/* <--- changed */}
                    <button
                        style={styles.settingsButton}
                        onClick={() => setSettingsOpen((prev) => !prev)}
                        aria-label="Chart settings"
                    >
                        <span style={styles.settingsIcon}>
                            <span style={styles.sliderIconLine}>
                                <span style={styles.sliderIconKnobLeft} />
                            </span>
                            <span style={styles.sliderIconLine}>
                                <span style={styles.sliderIconKnobRight} />
                            </span>
                            <span style={styles.sliderIconLine}>
                                <span style={styles.sliderIconKnobCenter} />
                            </span>
                        </span>
                    </button>

                    {settingsOpen && (
                        <div style={styles.settingsMenu}>
                            <div style={styles.settingsHeader}>
                                <div>
                                    <div style={styles.settingsTitle}>Chart Settings</div>
                                    <div style={styles.settingsSubtitle}>Customize your game view</div>
                                </div>

                                <button
                                    style={styles.settingsClose}
                                    onClick={() => setSettingsOpen(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div style={styles.settingsSection}>
                                <div style={styles.settingsSectionTitle}>Candles</div>

                                <div style={styles.colorControlRow}>
                                    <div>
                                        <div style={styles.colorLabel}>Bullish</div>
                                        <div style={styles.colorHint}>Up candle color</div>
                                    </div>

                                    <input
                                        type="color"
                                        value={bullCandleColor}
                                        onChange={(event) => setBullCandleColor(event.target.value)}
                                        style={styles.colorPicker}
                                    />
                                </div>

                                <div style={styles.colorControlRow}>
                                    <div>
                                        <div style={styles.colorLabel}>Bearish</div>
                                        <div style={styles.colorHint}>Down candle color</div>
                                    </div>

                                    <input
                                        type="color"
                                        value={bearCandleColor}
                                        onChange={(event) => setBearCandleColor(event.target.value)}
                                        style={styles.colorPicker}
                                    />
                                </div>
                            </div>

                            <div style={styles.settingsSection}>
                                <div style={styles.settingsSectionTitle}>Top Timeframes</div>

                                <div style={styles.timeframeToggleGrid}>
                                    {["15m", "30m", "1h", "4h", "Daily"].map((tf) => (
                                        <button
                                            key={tf}
                                            style={{
                                                ...styles.timeframeToggle,
                                                ...(visibleTimeframes[tf]
                                                    ? styles.timeframeToggleActive
                                                    : {}),
                                            }}
                                            onClick={() => toggleTimeframeVisibility(tf)}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                style={styles.resetSettingsButton}
                                onClick={resetVisualSettings}
                            >
                                RESET SETTINGS
                            </button>
                        </div>
                    )}
                </div>

                <div style={styles.marketTimeBlock}> {/* <--- changed */}
                    <div style={styles.marketTimeLabel}>
                        <span style={styles.liveDot} />
                        MARKET TIME
                    </div>

                    <div style={styles.marketTimeValue}>
                        {marketDateTimeText}
                    </div>

                    <div style={styles.marketSessionValue}>
                        {marketSessionText}
                    </div>
                </div>

                <div style={styles.chartWrap}>
                    <button
                        style={styles.pauseButton}
                        onClick={handleToggleSimulationPause}
                        aria-label={simulationPaused ? "Resume simulation" : "Pause simulation"}
                    >
                        {simulationPaused ? (
                            <span style={styles.playIcon} />
                        ) : (
                            <span style={styles.pauseIcon}>
                                <span style={styles.pauseBar} />
                                <span style={styles.pauseBar} />
                            </span>
                        )}
                    </button>

                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleChartMouseDown}
                        onMouseMove={handleChartMouseMove}
                        onMouseUp={handleChartMouseUp}
                        onMouseLeave={handleChartMouseLeave}
                        onTouchStart={handleChartTouchStart}
                        onTouchMove={handleChartTouchMove}
                        onTouchEnd={handleChartTouchEnd}
                        style={{
                            touchAction: "none",
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            WebkitTapHighlightColor: "transparent",
                        }}
                    />
                </div>

                <div style={styles.tradePanel}>
                    <input
                        style={styles.input}
                        value={quantity}
                        type="number"
                        min="1"
                        onChange={(e) => {
                            const value = Number(e.target.value);
                            setQuantity(
                                Number.isFinite(value)
                                    ? Math.max(1, Math.min(value, 100))
                                    : 1
                            );
                        }}
                    />

                    {position ? (
                        <>
                            <button style={styles.closePosition} onClick={handleClosePosition}>
                                CLOSE POSITION
                            </button>

                            <button
                                style={styles.closePartials}
                                onClick={handleClosePartials}
                            >
                                CLOSE PARTIALS
                            </button>

                            <button
                                style={styles.breakeven}
                                onClick={handleMoveStopToBreakeven}
                            >
                                BREAKEVEN
                            </button>

                            <button
                                style={{
                                    ...styles.trailingStop,
                                    opacity: position && isPositionInProfit(position) ? 1 : 0.45, // <--- changed
                                }}
                                onClick={handleTrailingStopMode}
                            >
                                TRAILING STOP
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                style={{
                                    ...styles.buy,
                                    opacity: balance > 0 ? 1 : 0.35, // <--- changed
                                }}
                                onClick={handleBuy}
                            >
                                BUY
                            </button>

                            <button
                                style={{
                                    ...styles.sell,
                                    opacity: balance > 0 ? 1 : 0.35, // <--- changed
                                }}
                                onClick={handleSell}
                            >
                                SELL
                            </button>

                            <button
                                style={{
                                    ...styles.pendingOrder,
                                    opacity: balance > 0 ? 1 : 0.35, // <--- changed
                                }}
                                onClick={handlePendingOrderButton}
                            >
                                PENDING ORDER
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    app: {
        width: "100%",
        height: "100dvh", // <--- changed
        minHeight: "100dvh", // <--- changed
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#050505",
        overflow: "hidden",
        userSelect: "none", // <--- changed
        WebkitUserSelect: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
        touchAction: "none", // <--- changed
    },
    orientationBlocker: {
        position: "fixed", // <--- changed
        inset: 0, // <--- changed
        zIndex: 9999, // <--- changed
        background: "#050505", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        justifyContent: "center", // <--- changed
        alignItems: "center", // <--- changed
        textAlign: "center", // <--- changed
        padding: 24, // <--- changed
        userSelect: "none", // <--- changed
        WebkitUserSelect: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    orientationTitle: {
        fontSize: 28, // <--- changed
        fontWeight: 900, // <--- changed
        marginBottom: 10, // <--- changed
    },
    orientationText: {
        fontSize: 16, // <--- changed
        fontWeight: 700, // <--- changed
        color: "#a0a0a0", // <--- changed
    },
    gameFrame: {
        width: "min(480px, 100vw)",
        height: "min(980px, 100dvh)",
        maxHeight: "100dvh", // <--- changed
        aspectRatio: "9 / 19.5",
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 26,
        color: "white",
        fontFamily: "Arial, sans-serif",
        userSelect: "none", // <--- changed
        WebkitUserSelect: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
        touchAction: "none", // <--- changed
    },
    topPanel: {
        background: "#181818",
        borderBottom: "1px solid #2a2a2a",
        padding: "18px 24px 16px", // <--- changed
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        alignItems: "center", // <--- changed
        minHeight: 74, // <--- changed
    },
    topMetric: {
        minHeight: 40, // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        justifyContent: "center", // <--- changed
    },
    label: {
        color: "#7b7b7b",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        marginBottom: 7, // <--- changed
        lineHeight: 1, // <--- changed
    },
    value: {
        color: "#ffffff",
        fontSize: 20,
        fontWeight: 800,
        lineHeight: 1,
        minHeight: 20, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
    },
    contractCount: {
        color: "#8f8f8f",
        fontSize: 11,
        fontWeight: 800,
        marginTop: 6,
        lineHeight: 1,
        textTransform: "uppercase",
        minHeight: 11, // <--- changed
    },
    timeframes: {
        background: "#181818",
        padding: "12px 12px 14px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(56px, 1fr))", // <--- changed
        gap: 8,
        borderBottom: "1px solid #1f1f1f",
    },
    tfButton: {
        background: "#222222",
        color: "#ffffff",
        border: "none",
        borderRadius: 6,
        height: 34,
        fontSize: 20, // <--- changed
        fontWeight: 700,
        cursor: "pointer",
    },
    tfActive: {
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 6,
        height: 34,
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
    },
    marketTimeBlock: {
        background: "transparent", // <--- changed
        border: "none", // <--- changed
        padding: "10px 72px 6px 72px", // <--- changed: moved upward and aligned with settings button
        marginTop: "0px", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        gap: 2, // <--- changed
        textAlign: "center", // <--- changed
        lineHeight: 1, // <--- changed
        overflow: "visible", // <--- changed
        minHeight: "auto", // <--- changed
        height: "auto", // <--- changed
        flexShrink: 0, // <--- changed
        width: "100%", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    marketTimeLabel: {
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        gap: 7, // <--- changed
        color: "#707070", // <--- changed
        fontSize: 10, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: 0.8, // <--- changed
        textTransform: "uppercase", // <--- changed
        whiteSpace: "nowrap", // <--- changed
        lineHeight: 1.05, // <--- changed
        width: "100%", // <--- changed
    },
    liveDot: {
        width: 7, // <--- changed
        height: 7, // <--- changed
        borderRadius: 999, // <--- changed
        background: "#14c78a", // <--- changed
        boxShadow: "0 0 12px rgba(20,199,138,0.85)", // <--- changed
        display: "inline-block", // <--- changed
    },
    marketTimeValue: {
        color: "#ffffff", // <--- changed
        fontSize: 13, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: 0.2, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        lineHeight: 1.2, // <--- changed
        textAlign: "center", // <--- changed
        width: "100%", // <--- changed
    },
    marketSessionValue: {
        color: "#14c78a", // <--- changed
        fontSize: 11, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: 0.3, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        lineHeight: 1.2, // <--- changed
        textAlign: "center", // <--- changed
        width: "100%", // <--- changed
    },
    floatingSettingsWrap: {
        position: "absolute", // <--- changed
        top: "148px", // <--- changed: vertically centered with market time text
        right: 14, // <--- changed
        zIndex: 60, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
    },
    settingsButton: {
        width: 34, // <--- changed
        height: 34, // <--- changed
        borderRadius: 12, // <--- changed
        border: "1px solid rgba(255,255,255,0.16)", // <--- changed
        background: "rgba(255,255,255,0.08)", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        cursor: "pointer", // <--- changed
        boxShadow: "0 8px 20px rgba(0,0,0,0.38)", // <--- changed
        padding: 0, // <--- changed
    },
    settingsIcon: {
        width: 22, // <--- changed
        height: 18, // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        gap: 4, // <--- changed
        color: "#ffffff", // <--- changed
    },
    sliderIconLine: {
        width: 20, // <--- changed
        height: 2, // <--- changed
        borderRadius: 99, // <--- changed
        background: "#ffffff", // <--- changed
        position: "relative", // <--- changed
        display: "block", // <--- changed
    },
    sliderIconKnobLeft: {
        position: "absolute", // <--- changed
        left: 3, // <--- changed
        top: "50%", // <--- changed
        width: 5, // <--- changed
        height: 5, // <--- changed
        borderRadius: 99, // <--- changed
        background: "#ffffff", // <--- changed
        transform: "translateY(-50%)", // <--- changed
        boxShadow: "0 0 0 2px #151515", // <--- changed
    },
    sliderIconKnobRight: {
        position: "absolute", // <--- changed
        right: 3, // <--- changed
        top: "50%", // <--- changed
        width: 5, // <--- changed
        height: 5, // <--- changed
        borderRadius: 99, // <--- changed
        background: "#ffffff", // <--- changed
        transform: "translateY(-50%)", // <--- changed
        boxShadow: "0 0 0 2px #151515", // <--- changed
    },
    sliderIconKnobCenter: {
        position: "absolute", // <--- changed
        left: "50%", // <--- changed
        top: "50%", // <--- changed
        width: 5, // <--- changed
        height: 5, // <--- changed
        borderRadius: 99, // <--- changed
        background: "#ffffff", // <--- changed
        transform: "translate(-50%, -50%)", // <--- changed
        boxShadow: "0 0 0 2px #151515", // <--- changed
    },
    settingsMenu: {
        position: "absolute", // <--- changed
        top: 48, // <--- changed
        right: 0, // <--- changed
        width: 292, // <--- changed
        maxWidth: "calc(100vw - 28px)", // <--- changed
        borderRadius: 22, // <--- changed
        background: "linear-gradient(180deg, rgba(32,32,32,0.98), rgba(12,12,12,0.98))", // <--- changed
        border: "1px solid rgba(255,255,255,0.12)", // <--- changed
        boxShadow: "0 24px 55px rgba(0,0,0,0.72)", // <--- changed
        padding: 16, // <--- changed
        zIndex: 50, // <--- changed
        backdropFilter: "blur(12px)", // <--- changed
    },
    settingsHeader: {
        display: "flex", // <--- changed
        justifyContent: "space-between", // <--- changed
        alignItems: "flex-start", // <--- changed
        gap: 12, // <--- changed
        marginBottom: 16, // <--- changed
    },
    settingsTitle: {
        fontSize: 18, // <--- changed
        fontWeight: 900, // <--- changed
        color: "#ffffff", // <--- changed
        lineHeight: 1, // <--- changed
    },
    settingsSubtitle: {
        marginTop: 5, // <--- changed
        fontSize: 11, // <--- changed
        color: "#8d8d8d", // <--- changed
        fontWeight: 700, // <--- changed
        textTransform: "uppercase", // <--- changed
        letterSpacing: 0.4, // <--- changed
    },
    settingsClose: {
        width: 28, // <--- changed
        height: 28, // <--- changed
        borderRadius: 10, // <--- changed
        border: "none", // <--- changed
        background: "rgba(255,255,255,0.1)", // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 20, // <--- changed
        fontWeight: 900, // <--- changed
        lineHeight: 1, // <--- changed
        cursor: "pointer", // <--- changed
    },
    settingsSection: {
        borderRadius: 16, // <--- changed
        background: "rgba(255,255,255,0.055)", // <--- changed
        border: "1px solid rgba(255,255,255,0.08)", // <--- changed
        padding: 12, // <--- changed
        marginBottom: 12, // <--- changed
    },
    settingsSectionTitle: {
        color: "#ffffff", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: 0.5, // <--- changed
        textTransform: "uppercase", // <--- changed
        marginBottom: 10, // <--- changed
    },
    colorControlRow: {
        display: "flex", // <--- changed
        justifyContent: "space-between", // <--- changed
        alignItems: "center", // <--- changed
        gap: 12, // <--- changed
        padding: "9px 0", // <--- changed
        borderTop: "1px solid rgba(255,255,255,0.06)", // <--- changed
    },
    colorLabel: {
        color: "#ffffff", // <--- changed
        fontSize: 13, // <--- changed
        fontWeight: 900, // <--- changed
        lineHeight: 1, // <--- changed
    },
    colorHint: {
        marginTop: 5, // <--- changed
        color: "#848484", // <--- changed
        fontSize: 11, // <--- changed
        fontWeight: 700, // <--- changed
    },
    colorPicker: {
        width: 44, // <--- changed
        height: 34, // <--- changed
        border: "none", // <--- changed
        borderRadius: 12, // <--- changed
        background: "transparent", // <--- changed
        cursor: "pointer", // <--- changed
        padding: 0, // <--- changed
    },
    timeframeToggleGrid: {
        display: "grid", // <--- changed
        gridTemplateColumns: "repeat(5, 1fr)", // <--- changed
        gap: 7, // <--- changed
    },
    timeframeToggle: {
        height: 32, // <--- changed
        borderRadius: 11, // <--- changed
        border: "1px solid rgba(255,255,255,0.1)", // <--- changed
        background: "rgba(255,255,255,0.07)", // <--- changed
        color: "#808080", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 900, // <--- changed
        cursor: "pointer", // <--- changed
    },
    timeframeToggleActive: {
        background: "#ffffff", // <--- changed
        color: "#050505", // <--- changed
        border: "1px solid #ffffff", // <--- changed
    },
    resetSettingsButton: {
        width: "100%", // <--- changed
        height: 38, // <--- changed
        borderRadius: 14, // <--- changed
        border: "none", // <--- changed
        background: "rgba(47,140,255,0.18)", // <--- changed
        color: "#7db8ff", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 900, // <--- changed
        cursor: "pointer", // <--- changed
        letterSpacing: 0.4, // <--- changed
    },
    chartWrap: {
        flex: 1,
        minHeight: 0,
        background: "#050505",
        position: "relative", // <--- changed
    },
    pauseButton: {
        position: "absolute", // <--- changed
        right: 16, // <--- changed
        bottom: 18, // <--- changed
        width: 44, // <--- changed
        height: 44, // <--- changed
        borderRadius: 16, // <--- changed
        border: "1px solid rgba(255,255,255,0.14)", // <--- changed
        background: "rgba(18,18,18,0.82)", // <--- changed
        boxShadow: "0 12px 28px rgba(0,0,0,0.55)", // <--- changed
        backdropFilter: "blur(10px)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        cursor: "pointer", // <--- changed
        zIndex: 20, // <--- changed
        padding: 0, // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    pauseIcon: {
        display: "flex", // <--- changed
        gap: 5, // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
    },
    pauseBar: {
        width: 5, // <--- changed
        height: 18, // <--- changed
        borderRadius: 4, // <--- changed
        background: "#ffffff", // <--- changed
        display: "block", // <--- changed
    },
    playIcon: {
        width: 0, // <--- changed
        height: 0, // <--- changed
        borderTop: "9px solid transparent", // <--- changed
        borderBottom: "9px solid transparent", // <--- changed
        borderLeft: "14px solid #ffffff", // <--- changed
        transform: "translateX(2px)", // <--- changed
    },
    tradePanel: {
        background: "#1b1b1b",
        padding: "24px 22px 30px", // <--- changed
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gridTemplateRows: "52px 52px", // <--- changed
        columnGap: 8, // <--- changed
        rowGap: 14, // <--- changed
        borderRadius: "24px 24px 0 0",
        alignItems: "stretch",
        justifyItems: "stretch",
        width: "100%", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    input: {
        gridColumn: "1", // <--- changed
        gridRow: "1", // <--- changed
        background: "#050505",
        color: "white",
        border: "1px solid #222",
        borderRadius: 18,
        textAlign: "center",
        fontSize: 28,
        fontWeight: 900,
        width: "100%",
        height: "100%", // <--- changed
        boxSizing: "border-box", // <--- changed
        padding: 0, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        minWidth: 0, // <--- changed
        maxWidth: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
    },
    buy: {
        gridColumn: "2",
        gridRow: "1",
        background: GREEN,
        color: "white",
        border: "none",
        borderRadius: 18,
        fontSize: 26,
        fontWeight: 900,
        cursor: "pointer",
        width: "100%", // <--- changed
        height: "100%", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        minWidth: 0, // <--- changed
        maxWidth: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
    },
    sell: {
        gridColumn: "3",
        gridRow: "1",
        background: "#ff2f3a",
        color: "white",
        border: "none",
        borderRadius: 18,
        fontSize: 26,
        fontWeight: 900,
        cursor: "pointer",
        width: "100%", // <--- changed
        height: "100%", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        minWidth: 0, // <--- changed
        maxWidth: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
    },
    closePosition: {
        gridColumn: "2 / 4",
        gridRow: "1",
        background: "#ff2f3a", // <--- changed
        color: "#ffffff", // <--- changed,
        border: "none",
        borderRadius: 14,
        fontSize: 16,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0, // <--- changed
        width: "100%", // <--- changed
        maxWidth: "100%", // <--- changed
        height: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        textAlign: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        padding: "0 6px", // <--- changed
    },
    closePartials: {
        gridColumn: "1",
        gridRow: "2",
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 14,
        fontSize: 11, // <--- changed
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0, // <--- changed
        width: "100%", // <--- changed
        maxWidth: "100%", // <--- changed
        height: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        textAlign: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        padding: "0 2px", // <--- changed
        whiteSpace: "nowrap", // <--- changed
    },
    breakeven: {
        gridColumn: "2",
        gridRow: "2",
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 14,
        fontSize: 11, // <--- changed
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0, // <--- changed
        width: "100%", // <--- changed
        maxWidth: "100%", // <--- changed
        height: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        textAlign: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        padding: "0 2px", // <--- changed
        whiteSpace: "nowrap", // <--- changed
    },
    trailingStop: {
        gridColumn: "3",
        gridRow: "2",
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 14,
        fontSize: 11, // <--- changed
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0, // <--- changed
        width: "100%", // <--- changed
        maxWidth: "100%", // <--- changed
        height: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        textAlign: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        padding: "0 2px", // <--- changed
        whiteSpace: "nowrap", // <--- changed
    },
    pendingOrder: {
        gridColumn: "1 / 4",
        gridRow: "2",
        background: PENDING_BUTTON_BLUE, // <--- changed
        color: "#ffffff", // <--- changed
        border: "none",
        borderRadius: 14,
        fontSize: 26,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0, // <--- changed
        width: "100%", // <--- changed
        maxWidth: "100%", // <--- changed
        height: "100%", // <--- changed
        justifySelf: "stretch", // <--- changed
        alignSelf: "stretch", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        textAlign: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        padding: "0 6px", // <--- changed
    },
};