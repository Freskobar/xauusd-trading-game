import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type TouchEvent as ReactTouchEvent,
} from "react";
import centraBankIcon from "../assets/centra-bank-icon.png";
import nestIcon from "../assets/nest-icon.png";
import settingsIcon from "../assets/settings-icon.png";
import dashlyIcon from "../assets/dashly-icon.png";
import appHubIcon from "../assets/app-hub-icon.png";
import titanGymIcon from "../assets/titan-gym-icon.png";
import locaraIcon from "../assets/locara-icon.png";
import throttleIcon from "../assets/throttle-icon.png";
import vaulteIcon from "../assets/vaulte-icon.png";
import vantaIcon from "../assets/vanta-icon.png";
import ilearnIcon from "../assets/ilearn-icon.png";
import itradeIcon from "../assets/itrade-icon.png";

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

// Home screen tweak knobs // <--- changed
// Change these numbers to quickly tune the iPhone home screen layout. // <--- changed
const HOME_APP_SIZE = 56; // <--- changed: size of the normal home screen apps/icons
const HOME_APP_GRID_GAP = 16; // <--- changed: space between apps in the grid
const HOME_APP_GRID_VERTICAL_OFFSET = 30; // <--- changed: moves the entire app grid up/down

const HOME_SEARCH_WIDTH = 70; // <--- changed: width of the search bar
const HOME_SEARCH_HEIGHT = 25; // <--- changed: height of the search bar
const HOME_SEARCH_RADIUS = 999; // <--- changed: roundness of the search bar corners
const HOME_SEARCH_VERTICAL_OFFSET = 30; // <--- changed: moves the search bar up/down

const HOME_DOCK_WIDTH = 300; // <--- changed: width of the dock/background bar
const HOME_DOCK_APP_SIZE = HOME_APP_SIZE; // <--- changed: size of dock apps/icons
const HOME_DOCK_HEIGHT = HOME_DOCK_APP_SIZE + 20; // <--- changed: height of the dock
const HOME_DOCK_RADIUS = 28; // <--- changed: corner roundness of the dock
const HOME_DOCK_VERTICAL_OFFSET = 5; // <--- changed: moves the dock up/down
const HOME_DOCK_APP_HORIZONTAL_GAP = 14; // <--- changed: space between dock apps
const PHONE_HOME_BAR_BOTTOM_OFFSET = 8; // <--- changed: moves home bar down/up without pushing dock outside phone


// Centra Bank PNG icon tweak knobs // <--- changed
const CENTRA_ICON_SIZE = 75; // <--- changed: overall PNG size inside the app square
const CENTRA_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const CENTRA_ICON_Y_OFFSET = 2; // <--- changed: move image up/down inside the app square
const CENTRA_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square

// Nest PNG icon tweak knobs // <--- changed
const NEST_ICON_SIZE = 70; // <--- changed: overall PNG size inside the app square
const NEST_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const NEST_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const NEST_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square

// Settings PNG icon tweak knobs // <--- changed
const SETTINGS_ICON_SIZE = 65; // <--- changed: overall PNG size inside the app square
const SETTINGS_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const SETTINGS_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const SETTINGS_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// Dashly PNG icon tweak knobs // <--- changed
const DASHLY_ICON_SIZE = 70; // <--- changed: overall PNG size inside the app square
const DASHLY_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const DASHLY_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const DASHLY_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// App Hub PNG icon tweak knobs // <--- changed
const APP_HUB_ICON_SIZE = 65; // <--- changed: overall PNG size inside the app square
const APP_HUB_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const APP_HUB_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const APP_HUB_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// Titan Gym PNG icon tweak knobs // <--- changed
const TITAN_GYM_ICON_SIZE = 60; // <--- changed: overall PNG size inside the app square
const TITAN_GYM_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const TITAN_GYM_ICON_Y_OFFSET = 1; // <--- changed: move image up/down inside the app square
const TITAN_GYM_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// Locara PNG icon tweak knobs // <--- changed
const LOCARA_ICON_SIZE = 60; // <--- changed: overall PNG size inside the app square
const LOCARA_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const LOCARA_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const LOCARA_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// Throttle PNG icon tweak knobs // <--- changed
const THROTTLE_ICON_SIZE = 52; // <--- changed: overall PNG size inside the app square
const THROTTLE_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const THROTTLE_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const THROTTLE_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// Vaulte PNG icon tweak knobs // <--- changed
const VAULTE_ICON_SIZE = 50; // <--- changed: overall PNG size inside the app square
const VAULTE_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const VAULTE_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const VAULTE_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// Vanta PNG icon tweak knobs // <--- changed
const VANTA_ICON_SIZE = 55; // <--- changed: overall PNG size inside the app square
const VANTA_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const VANTA_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const VANTA_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// iLearn PNG icon tweak knobs // <--- changed
const ILEARN_ICON_SIZE = 62; // <--- changed: scales only the top PNG layer inside the fixed app square
const ILEARN_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const ILEARN_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const ILEARN_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square


// iTrade PNG icon tweak knobs // <--- changed
const ITRADE_ICON_SIZE = 62; // <--- changed: scales only the top PNG layer inside the fixed app square
const ITRADE_ICON_X_OFFSET = 0; // <--- changed: move image left/right inside the app square
const ITRADE_ICON_Y_OFFSET = 0; // <--- changed: move image up/down inside the app square
const ITRADE_ICON_RADIUS = 14.5; // <--- changed: corner roundness for the PNG inside the app square











const PHONE_VERTICAL_SHIFT = 150; // <--- changed: moves whole phone panel further down
const PHONE_BASE_WIDTH = 340; // <--- changed: PC-perfect full phone object width
const PHONE_BASE_HEIGHT = 680; // <--- changed: PC-perfect full phone object height

const PHONE_UNLOCK_SOUND_PATH = "/sounds/phone unlock.m4a"; // <--- changed: put this file in public/sounds/
const PHONE_LOCK_SOUND_PATH = "/sounds/phone lock.m4a"; // <--- changed: put this file in public/sounds/

const GAME_BASE_WIDTH = 480; // <--- changed: fixed professional design-stage width
const GAME_BASE_HEIGHT = 980; // <--- changed: fixed professional design-stage height

const HOME_APP_GRID_COLUMNS = 4; // <--- changed: locks app columns the same on PC and iPhone
const HOME_APP_GRID_ROWS = 5; // <--- changed: locks app rows the same on PC and iPhone
const HOME_APP_GRID_WIDTH = HOME_APP_GRID_COLUMNS * HOME_APP_SIZE + (HOME_APP_GRID_COLUMNS - 1) * HOME_APP_GRID_GAP; // <--- changed: fixed app grid width so iPhone Safari cannot stretch gaps
const HOME_BIG_APP_SIZE = HOME_APP_SIZE * 2 + HOME_APP_GRID_GAP; // <--- changed: true 2x2 app tile size




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

function formatPhoneStatusTime(timestamp: number) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
        .format(new Date(timestamp))
        .replace(" AM", "")
        .replace(" PM", ""); // <--- changed
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


function getAlignedMarketDisplayTimestamp(
    active15mTimestamp: number,
    elapsedInside15mMs: number
) {
    return active15mTimestamp + getSimulatedMarketProgressMs(elapsedInside15mMs); // <--- changed: market time stays true to CSV candle time
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



function PhoneServiceSvg({ strength = 4 }: { strength?: number }) {
    return (
        <svg
            width="21"
            height="18"
            viewBox="0 0 21 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="geometricPrecision"
            style={{ display: "block", overflow: "visible" }}
            aria-label="Cellular signal"
        >
            {[0, 1, 2, 3].map((bar) => {
                const heights = [4.4, 7.2, 10, 12.8];
                const x = 1.25 + bar * 4.7;
                const y = 15.4 - heights[bar];

                return (
                    <rect
                        key={bar}
                        x={x}
                        y={y}
                        width="3.25"
                        height={heights[bar]}
                        rx="0.35"
                        fill="currentColor"
                        opacity={bar < strength ? 1 : 0.28}
                    />
                );
            })}
        </svg>
    );
}

function PhoneWifiSvg({ strength = 3 }: { strength?: number }) {
    return (
        <svg
            width="21"
            height="18"
            viewBox="0 0 21 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="geometricPrecision"
            style={{ display: "block", overflow: "visible" }}
            aria-label="Wi-Fi"
            preserveAspectRatio="xMidYMid meet"
        >
            <path
                d="M2.65 5.25C6.9 1.45 14.1 1.45 18.35 5.25L16.3 7.25C12.95 4.45 8.05 4.45 4.7 7.25Z"
                fill="currentColor"
                opacity={strength >= 3 ? 1 : 0.25}
            />
            <path
                d="M5.8 8.95C8.45 6.7 12.55 6.7 15.2 8.95L13.15 10.95C11.55 9.65 9.45 9.65 7.85 10.95Z"
                fill="currentColor"
                opacity={strength >= 2 ? 1 : 0.25}
            />
            <path
                d="M8.65 12.55C9.65 11.65 11.35 11.65 12.35 12.55L10.5 14.45Z"
                fill="currentColor"
                opacity={strength >= 1 ? 1 : 0.25}
            />
        </svg>
    );
}

function PhoneBatterySvg({ percent }: { percent: number | null }) {
    const safePercent = Math.max(0, Math.min(100, percent ?? 67));
    const fillWidth = Math.max(2, Math.min(25, (safePercent / 100) * 25));

    return (
        <svg
            width="31"
            height="18"
            viewBox="0 0 31 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="geometricPrecision"
            style={{ display: "block", overflow: "visible" }}
            aria-label="Battery"
        >
            <defs>
                <clipPath id="iphoneBatteryClipCrisp">
                    <rect
                        x="1"
                        y="2.75"
                        width="25"
                        height="12.5"
                        rx="2.8"
                    />
                </clipPath>
            </defs>

            <rect
                x="1"
                y="2.75"
                width="25"
                height="12.5"
                rx="2.8"
                fill="rgba(255,255,255,0.34)"
            />

            <rect
                x="1"
                y="2.75"
                width={fillWidth}
                height="12.5"
                rx="0"
                fill="rgba(255,255,255,0.96)"
                clipPath="url(#iphoneBatteryClipCrisp)"
            />

            <path
                d="M27.15 6.45H27.85C28.55 6.45 29 7.55 29 9C29 10.45 28.55 11.55 27.85 11.55H27.15Z"
                fill="rgba(255,255,255,0.34)"
            />

            <text
                x="13.5"
                y="9.15"
                textAnchor="middle"
                dominantBaseline="middle" // <--- changed: keeps battery percentage vertically centered on mobile Safari
                alignmentBaseline="middle" // <--- changed: extra Safari/iOS alignment help
                fontSize="10.9" // <--- changed: fixed size so the whole phone scales as one object
                fontWeight="900"
                fill="#050505"
                fontFamily="Arial, sans-serif"
                style={{
                    WebkitFontSmoothing: "antialiased",
                    textRendering: "geometricPrecision",
                }}
            >
                {safePercent}
            </text>
        </svg>
    );
}

function IPhonePhoneIconSvg() { // <--- changed
    return (
        <svg
            width="48"
            height="48"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Phone"
            style={{ display: "block" }}
        >
            <g transform="translate(32 32) rotate(-8) translate(-32 -32)"> {/* <--- changed: centers the phone glyph inside the green app square */}
                <path
                    d="M46.2 43.6c-1.35 1.35-3.35 2.05-5.75 2.05-6.25 0-15.25-4.9-22.7-12.35C10.3 25.85 5.4 16.85 5.4 10.6c0-2.4.7-4.4 2.05-5.75l4.2-4.2c.95-.95 2.5-.95 3.45 0l8.15 8.15c.95.95.95 2.5 0 3.45l-4.8 4.8c-.6.6-.7 1.45-.35 2.15 1.3 2.9 3.5 5.9 6.25 8.65s5.75 4.95 8.65 6.25c.7.35 1.55.25 2.15-.35l4.8-4.8c.95-.95 2.5-.95 3.45 0l8.15 8.15c.95.95.95 2.5 0 3.45l-5.3 3.05Z"
                    fill="white"
                    transform="translate(4.6 9.1)"
                />
            </g>
        </svg>
    );
}

function IPhoneMessagesIconSvg() { // <--- changed
    return (
        <svg
            width="48"
            height="48"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Messages"
            style={{ display: "block" }}
        >
            <g transform="translate(64 0) scale(-1 1)"> {/* <--- changed: centered bubble while keeping the horizontal flip */}
                <path
                    d="M32 10.6C18.25 10.6 7.1 19.4 7.1 30.25C7.1 41.1 18.25 49.9 32 49.9C34.95 49.9 37.75 49.5 40.35 48.75C44.25 51.25 48.55 52.65 53.1 52.95C54 53 54.55 52 54.05 51.3C52.25 48.75 51 46.15 50.5 43.7C54.45 40.25 56.9 35.55 56.9 30.25C56.9 19.4 45.75 10.6 32 10.6Z"
                    fill="white"
                />
            </g>
        </svg>
    );
}

function IPhoneMusicIconSvg() { // <--- changed
    return (
        <svg
            width="48"
            height="48"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Music"
            style={{ display: "block" }}
        >
            <g transform="translate(3 2)"> {/* <--- changed: nudged music glyph to true visual center inside dock app */}
                <path
                    d="M45.8 6.8C47.95 6.42 50 8.08 50 10.28V38.65C50 45.15 45.45 49.95 39.05 49.95C34.45 49.95 31.05 47.15 31.05 43.45C31.05 39.25 34.95 36.05 39.95 36.05C41.45 36.05 42.7 36.32 43.65 36.75V21.15L23.1 24.82V45.9C23.1 52.4 18.55 57.2 12.15 57.2C7.55 57.2 4.15 54.4 4.15 50.7C4.15 46.5 8.05 43.3 13.05 43.3C14.55 43.3 15.8 43.57 16.75 44V17.2C16.75 15.52 17.98 14.08 19.62 13.78L45.8 6.8Z"
                    fill="white"
                />
                <path
                    d="M23.1 19.15L43.65 15.48V10.85L23.1 14.55V19.15Z"
                    fill="white"
                />
            </g>
        </svg>
    );
}



const DIAL_PAD_SOUND_PATHS: Record<string, string> = { // <--- changed
    "1": "/sounds/1.m4a", // <--- changed
    "2": "/sounds/2.m4a", // <--- changed
    "3": "/sounds/3.m4a", // <--- changed
    "4": "/sounds/4.m4a", // <--- changed
    "5": "/sounds/5.m4a", // <--- changed
    "6": "/sounds/6.m4a", // <--- changed
    "7": "/sounds/7.m4a", // <--- changed
    "8": "/sounds/8.m4a", // <--- changed
    "9": "/sounds/9.m4a", // <--- changed
    "0": "/sounds/0.m4a", // <--- changed
    "*": "/sounds/asterik.m4a", // <--- changed: filename in public/sounds
    "#": "/sounds/pound.m4a", // <--- changed: filename in public/sounds
};

function playDialPadSound(value: string) { // <--- changed
    const soundPath = DIAL_PAD_SOUND_PATHS[value]; // <--- changed
    if (!soundPath) return; // <--- changed

    const sound = new Audio(soundPath); // <--- changed: fresh audio lets repeated same-key taps play immediately
    sound.preload = "auto"; // <--- changed
    sound.currentTime = 0; // <--- changed
    sound.volume = 0.45; // <--- changed
    sound.play().catch(() => { // <--- changed
        // Browser may block audio until direct user interaction is allowed. // <--- changed
    }); // <--- changed
}

function formatDialedPhoneNumber(value: string) { // <--- changed
    if (value === "Calling...") return value; // <--- changed

    const dialChars = value.replace(/[^0-9*#]/g, "").slice(0, 10); // <--- changed: allows *, #, and digits

    if (dialChars.length === 0) return ""; // <--- changed

    const startsWithSpecialCode = dialChars.startsWith("*") || dialChars.startsWith("#"); // <--- changed

    if (startsWithSpecialCode) { // <--- changed: iPhone-style special-code dialing, example *99 999-9999
        const prefix = dialChars.slice(0, 3); // <--- changed: *99 or #99
        const rest = dialChars.slice(3); // <--- changed

        if (dialChars.length <= 3) return dialChars; // <--- changed: example *99
        if (rest.length <= 3) return `${prefix} ${rest}`; // <--- changed: example *99 999

        return `${prefix} ${rest.slice(0, 3)}-${rest.slice(3, 7)}`; // <--- changed: example *99 999-9999
    }

    const digits = dialChars.replace(/\D/g, "").slice(0, 10); // <--- changed

    if (digits.length === 0) return dialChars; // <--- changed: fallback for non-leading special symbols
    if (digits.length <= 3) return digits; // <--- changed: iPhone-style early dialing stage, example 999
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`; // <--- changed: iPhone-style middle stage, example 999-9999

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`; // <--- changed: iPhone-style full number, example (999) 999-9999
}


function PhoneBackspaceIcon() { // <--- changed: custom SVG delete icon renders consistently on PC and iPhone
    return (
        <svg
            width="31" // <--- changed: slightly larger delete icon
            height="24" // <--- changed: slightly larger delete icon
            viewBox="0 0 28 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                width: 31, // <--- changed: slightly larger delete icon
                height: 24, // <--- changed: slightly larger delete icon
                flexShrink: 0,
                transform: "translateY(0.25px)",
            }}
        >
            <path
                d="M10.35 3.25H24.05C25.25 3.25 26.25 4.25 26.25 5.45V16.55C26.25 17.75 25.25 18.75 24.05 18.75H10.35L1.95 11L10.35 3.25Z"
                fill="transparent" // <--- changed: no solid grey fill
                stroke="rgba(255,255,255,0.92)" // <--- changed: white outline delete shape
                strokeWidth="1.75" // <--- changed
                strokeLinejoin="round" // <--- changed
            />
            <path
                d="M15.45 7.75L20.7 13M20.7 7.75L15.45 13"
                stroke="#ffffff" // <--- changed: white X in center
                strokeWidth="2.15"
                strokeLinecap="round"
            />
        </svg>
    );
}



function PhoneKeypadTabIcon() { // <--- changed: locked to the same 26px visual box as every Phone tab icon
    const dots = [0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => ({
            cx: 8 + col * 6,
            cy: 7 + row * 5.8,
        }))
    );

    return (
        <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                width: 26,
                height: 26,
                flexShrink: 0,
            }}
        >
            {dots.map((dot, index) => (
                <circle
                    key={index}
                    cx={dot.cx}
                    cy={dot.cy}
                    r="1.55"
                    fill="currentColor"
                />
            ))}
        </svg>
    );
}

function PhoneContactsTabIcon() { // <--- changed: locked profile icon size/gap to match Calls/Keypad/Search
    return (
        <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                width: 26,
                height: 26,
                flexShrink: 0,
            }}
        >
            <circle
                cx="13"
                cy="8.25"
                r="3.85"
                fill="currentColor"
            />
            <path
                d="M5.8 21.1C6.28 16.72 9.18 14.15 13 14.15C16.82 14.15 19.72 16.72 20.2 21.1C20.28 21.78 19.75 22.35 19.07 22.35H6.93C6.25 22.35 5.72 21.78 5.8 21.1Z"
                fill="currentColor"
            />
        </svg>
    );
}

function PhoneCallsTabIcon() { // <--- changed: restored perfected clean clock/history icon
    return (
        <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                width: 26,
                height: 26,
                flexShrink: 0,
                overflow: "visible",
            }}
        >
            <circle
                cx="13"
                cy="13"
                r="8.65"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
            />
            <path
                d="M13 7.75V13.05L16.65 15.35"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function PhoneSearchTabIcon() { // <--- changed: locked magnifier icon size/gap to match Calls/Contacts/Keypad
    return (
        <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                width: 26,
                height: 26,
                flexShrink: 0,
            }}
        >
            <circle
                cx="11.3"
                cy="11.3"
                r="5.85"
                stroke="currentColor"
                strokeWidth="2.3"
            />
            <path
                d="M15.85 15.85L20.8 20.8"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IPhonePhoneApp({ // <--- changed
    dialedNumber,
    closing,
    onDigit,
    onDelete,
    onCall,
}: {
    dialedNumber: string;
    closing: boolean;
    onDigit: (value: string) => void;
    onDelete: () => void;
    onCall: () => void;
}) {
    const [pressedDialKey, setPressedDialKey] = useState<string | null>(null); // <--- changed: tracks the exact keypad button being pressed
    const pressedDialKeyTimeoutRef = useRef<number | null>(null); // <--- changed: keeps every press visible briefly

    function pressDialKey(value: string) { // <--- changed: starts the light-gray press immediately on first touch/click
        playDialPadSound(value); // <--- changed: plays matching public/sounds keypad .m4a immediately

        if (pressedDialKeyTimeoutRef.current !== null) { // <--- changed
            window.clearTimeout(pressedDialKeyTimeoutRef.current); // <--- changed
            pressedDialKeyTimeoutRef.current = null; // <--- changed
        } // <--- changed

        setPressedDialKey(null); // <--- changed: force same-key repeat taps to visibly restart
        window.requestAnimationFrame(() => { // <--- changed
            setPressedDialKey(value); // <--- changed
        }); // <--- changed
    }

    function releaseDialKey(value: string) { // <--- changed: returns the key to normal gray after every press, even repeated same-key taps
        if (pressedDialKeyTimeoutRef.current !== null) { // <--- changed
            window.clearTimeout(pressedDialKeyTimeoutRef.current); // <--- changed
        } // <--- changed

        pressedDialKeyTimeoutRef.current = window.setTimeout(() => { // <--- changed
            setPressedDialKey((currentValue) => currentValue === value ? null : currentValue); // <--- changed
            pressedDialKeyTimeoutRef.current = null; // <--- changed
        }, 55); // <--- changed: shorter reset so the same key can flash again on the next tap
    }

    useEffect(() => { // <--- changed: cleans up the keypad press timer if the fake Phone app unmounts
        return () => { // <--- changed
            if (pressedDialKeyTimeoutRef.current !== null) { // <--- changed
                window.clearTimeout(pressedDialKeyTimeoutRef.current); // <--- changed
            } // <--- changed
        }; // <--- changed
    }, []); // <--- changed

    const keypadRows = [
        [
            { main: "1", sub: "" },
            { main: "2", sub: "ABC" },
            { main: "3", sub: "DEF" },
        ],
        [
            { main: "4", sub: "GHI" },
            { main: "5", sub: "JKL" },
            { main: "6", sub: "MNO" },
        ],
        [
            { main: "7", sub: "PQRS" },
            { main: "8", sub: "TUV" },
            { main: "9", sub: "WXYZ" },
        ],
        [
            { main: "*", sub: "" },
            { main: "0", sub: "+" },
            { main: "#", sub: "" },
        ],
    ];

    return (
        <div
            style={{
                ...styles.phoneAppPage,
                ...(closing ? styles.phoneAppPageClosing : {}),
            }}
        >
            <div style={styles.phoneAppTopSpacer} />

            <div style={styles.phoneDialerDisplayWrap}>
                <div style={styles.phoneDialerNumber}>
                    {formatDialedPhoneNumber(dialedNumber) || ""}
                </div>
                <button style={styles.phoneDialerAddNumber} type="button">
                    + Add Number
                </button>
            </div>

            <div style={styles.phoneDialerKeypad}>
                {keypadRows.flat().map((key) => (
                    <button
                        key={`${key.main}-${key.sub}`}
                        type="button"
                        style={{
                            ...styles.phoneDialerKey,
                            ...(pressedDialKey === key.main ? styles.phoneDialerKeyPressed : {}), // <--- changed: light gray only while actively pressed
                        }}
                        onPointerDown={() => { // <--- changed: press feedback starts immediately on every click/tap
                            pressDialKey(key.main); // <--- changed
                        }} // <--- changed
                        onPointerUp={() => releaseDialKey(key.main)} // <--- changed
                        onPointerLeave={() => releaseDialKey(key.main)} // <--- changed
                        onPointerCancel={() => releaseDialKey(key.main)} // <--- changed
                        onClick={() => onDigit(key.main)}
                    >
                        <span
                            style={{
                                ...styles.phoneDialerKeyMain,
                                ...(!key.sub ? styles.phoneDialerKeyMainCentered : {}), // <--- changed: centers *, #, and 1 when there is no letter row
                                ...(key.main === "*" ? styles.phoneDialerKeyAsterisk : {}), // <--- changed: makes * match # size and visual center
                            }}
                        >
                            {key.main}
                        </span>
                        {key.sub ? (
                            <span style={styles.phoneDialerKeySub}>{key.sub}</span>
                        ) : null}
                    </button>
                ))}
            </div>

            <div style={styles.phoneDialerActions}>
                <div style={styles.phoneDialerSideAction} />

                <button
                    type="button"
                    style={styles.phoneDialerCallButton}
                    onClick={onCall}
                    aria-label="Fake call"
                >
                    <IPhonePhoneIconSvg />
                </button>

                <button
                    type="button"
                    style={{
                        ...styles.phoneDialerDelete,
                        opacity: dialedNumber ? 1 : 0,
                        pointerEvents: dialedNumber ? "auto" : "none",
                    }}
                    onClick={onDelete}
                    aria-label="Delete number"
                >
                    <PhoneBackspaceIcon />
                </button>
            </div>

            <div style={styles.phoneDialerTabs}>
                {[
                    { id: "calls", icon: <PhoneCallsTabIcon />, label: "Calls" }, // <--- changed: SVG sized to match the other tab icons
                    { id: "contacts", icon: <PhoneContactsTabIcon />, label: "Contacts" }, // <--- changed: profile/head-and-shoulders icon
                    { id: "keypad", icon: <PhoneKeypadTabIcon />, label: "Keypad" }, // <--- changed: 3x3 keypad dots instead of one dot
                    { id: "search", icon: <PhoneSearchTabIcon />, label: "Search" }, // <--- changed: SVG magnifying glass sized to match the other tab icons
                ].map((tab) => (
                    <div
                        key={tab.id} // <--- changed: always a clean string key, fixes TypeScript key error
                        style={{
                            ...styles.phoneDialerTab,
                            ...(tab.id === "keypad" ? styles.phoneDialerTabActive : {}),
                        }}
                    >
                        <span style={styles.phoneDialerTabIcon}>{tab.icon}</span>
                        <span style={styles.phoneDialerTabLabel}>{tab.label}</span> {/* <--- changed: fixed label box prevents icon/text vertical settling */}
                    </div>
                ))}
            </div>
        </div>
    );
}



function IPhoneNestIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: NEST_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={nestIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: NEST_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={nestIcon}
                alt="Nest"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: NEST_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${NEST_ICON_X_OFFSET}px, ${NEST_ICON_Y_OFFSET}px) scale(${NEST_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneCentraIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: CENTRA_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={centraBankIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: CENTRA_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={centraBankIcon}
                alt="Centra Bank"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: CENTRA_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${CENTRA_ICON_X_OFFSET}px, ${CENTRA_ICON_Y_OFFSET}px) scale(${CENTRA_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneILearnIconSvg() { // <--- changed: uses PNG from src/assets/ilearn-icon.png with fixed app square
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: ILEARN_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={ilearnIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: -3, // <--- changed: crops out baked-in white/light PNG edge
                    width: HOME_APP_SIZE + 6, // <--- changed: keeps app square full while hiding outline
                    height: HOME_APP_SIZE + 6, // <--- changed
                    display: "block",
                    objectFit: "cover",
                    borderRadius: ILEARN_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={ilearnIcon}
                alt="iLearn"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: ILEARN_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${ILEARN_ICON_X_OFFSET}px, ${ILEARN_ICON_Y_OFFSET}px) scale(${ILEARN_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}


function IPhoneSettingsIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: SETTINGS_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={settingsIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: SETTINGS_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={settingsIcon}
                alt="Settings"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: SETTINGS_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${SETTINGS_ICON_X_OFFSET}px, ${SETTINGS_ICON_Y_OFFSET}px) scale(${SETTINGS_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneDashlyIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: DASHLY_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={dashlyIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: DASHLY_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={dashlyIcon}
                alt="Dashly"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: DASHLY_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${DASHLY_ICON_X_OFFSET}px, ${DASHLY_ICON_Y_OFFSET}px) scale(${DASHLY_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneAppHubIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: APP_HUB_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={appHubIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: APP_HUB_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={appHubIcon}
                alt="App Hub"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: APP_HUB_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${APP_HUB_ICON_X_OFFSET}px, ${APP_HUB_ICON_Y_OFFSET}px) scale(${APP_HUB_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneTitanGymIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: TITAN_GYM_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={titanGymIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: TITAN_GYM_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={titanGymIcon}
                alt="Titan Gym"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: TITAN_GYM_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${TITAN_GYM_ICON_X_OFFSET}px, ${TITAN_GYM_ICON_Y_OFFSET}px) scale(${TITAN_GYM_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneLocaraIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: LOCARA_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={locaraIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: LOCARA_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={locaraIcon}
                alt="Locara"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: LOCARA_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${LOCARA_ICON_X_OFFSET}px, ${LOCARA_ICON_Y_OFFSET}px) scale(${LOCARA_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneThrottleIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: THROTTLE_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={throttleIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: THROTTLE_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={throttleIcon}
                alt="Throttle"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: THROTTLE_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${THROTTLE_ICON_X_OFFSET}px, ${THROTTLE_ICON_Y_OFFSET}px) scale(${THROTTLE_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneVaulteIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: VAULTE_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={vaulteIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: VAULTE_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={vaulteIcon}
                alt="Vaulte"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: VAULTE_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${VAULTE_ICON_X_OFFSET}px, ${VAULTE_ICON_Y_OFFSET}px) scale(${VAULTE_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneVantaIconSvg() { // <--- changed: fixed app square with PNG-size knob only affecting top image
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: VANTA_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            {/* full-size base layer keeps the app square visually full-size */}
            <img
                src={vantaIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: VANTA_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            {/* tweak knob scales only this top PNG layer */}
            <img
                src={vantaIcon}
                alt="Vanta"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: VANTA_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${VANTA_ICON_X_OFFSET}px, ${VANTA_ICON_Y_OFFSET}px) scale(${VANTA_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}




function IPhoneITradeIconSvg() { // <--- changed: uses PNG from src/assets/itrade-icon.png with fixed app square
    return (
        <div
            style={{
                width: HOME_APP_SIZE,
                height: HOME_APP_SIZE,
                minWidth: HOME_APP_SIZE,
                minHeight: HOME_APP_SIZE,
                maxWidth: HOME_APP_SIZE,
                maxHeight: HOME_APP_SIZE,
                flex: `0 0 ${HOME_APP_SIZE}px`,
                flexShrink: 0,
                flexGrow: 0,
                aspectRatio: "1 / 1",
                position: "relative",
                display: "block",
                overflow: "hidden",
                borderRadius: ITRADE_ICON_RADIUS,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                pointerEvents: "none",
                userSelect: "none",
                lineHeight: 0,
            }}
        >
            <img
                src={itradeIcon}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{
                    position: "absolute",
                    inset: -3, // <--- changed: crops out baked-in white/light PNG edge
                    width: HOME_APP_SIZE + 6, // <--- changed: keeps app square full while hiding outline
                    height: HOME_APP_SIZE + 6, // <--- changed
                    display: "block",
                    objectFit: "cover",
                    borderRadius: ITRADE_ICON_RADIUS,
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />

            <img
                src={itradeIcon}
                alt="iTrade"
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: HOME_APP_SIZE,
                    height: HOME_APP_SIZE,
                    display: "block",
                    objectFit: "cover",
                    borderRadius: ITRADE_ICON_RADIUS,
                    transform: `translate(-50%, -50%) translate(${ITRADE_ICON_X_OFFSET}px, ${ITRADE_ICON_Y_OFFSET}px) scale(${ITRADE_ICON_SIZE / HOME_APP_SIZE})`,
                    transformOrigin: "center center",
                    pointerEvents: "none",
                    userSelect: "none",
                }}
            />
        </div>
    );
}



function IPhoneSafariIconSvg() { // <--- changed
    const tickMarks = Array.from({ length: 48 }, (_, index) => { // <--- changed
        const angle = index * 7.5; // <--- changed
        const isMajor = index % 4 === 0; // <--- changed
        const y1 = isMajor ? 5.85 : 6.9; // <--- changed: larger Safari compass tick ring
        const y2 = isMajor ? 10.75 : 10.15; // <--- changed: larger Safari compass tick ring

        return (
            <line
                key={index}
                x1="32"
                y1={y1}
                x2="32"
                y2={y2}
                stroke="white"
                strokeWidth={isMajor ? 1.05 : 0.72}
                strokeLinecap="round"
                opacity={isMajor ? 0.9 : 0.72}
                transform={`rotate(${angle} 32 32)`}
            />
        );
    });

    return (
        <svg
            width="54" // <--- changed: larger Safari symbol to match the other dock symbols
            height="54" // <--- changed: larger Safari symbol to match the other dock symbols
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Safari"
            style={{ display: "block" }}
        >
            <defs>
                <radialGradient id="safariCompassBlue" cx="34%" cy="24%" r="78%">
                    <stop offset="0%" stopColor="#75f5ff" />
                    <stop offset="44%" stopColor="#32c8f0" />
                    <stop offset="100%" stopColor="#0b78ee" />
                </radialGradient>
                <linearGradient id="safariRedNeedle" x1="20" y1="44" x2="44" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f5f5f5" />
                    <stop offset="48%" stopColor="#f5f5f5" />
                    <stop offset="49%" stopColor="#f04444" />
                    <stop offset="100%" stopColor="#df1d35" />
                </linearGradient>
            </defs>

            <circle
                cx="32"
                cy="32"
                r="26.15" // <--- changed: larger compass, no white outer border
                fill="url(#safariCompassBlue)"
            />

            {tickMarks}

            <circle
                cx="32"
                cy="32"
                r="20.7" // <--- changed
                stroke="rgba(255,255,255,0.42)"
                strokeWidth="0.55"
            />
            <circle
                cx="32"
                cy="32"
                r="15.75" // <--- changed
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="0.45"
            />

            <path
                d="M44.2 19.8L35.55 35.55L19.8 44.2L28.45 28.45L44.2 19.8Z" // <--- changed: larger needle to match larger compass
                fill="url(#safariRedNeedle)"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="0.35"
                strokeLinejoin="round"
            />
            <circle cx="32" cy="32" r="2.25" fill="white" />
            <circle cx="32" cy="32" r="1.25" fill="#0e83ee" />
        </svg>
    );
}



function playPhoneSound(audioRef: React.RefObject<HTMLAudioElement | null>) { // <--- changed
    const sound = audioRef.current; // <--- changed
    if (!sound) return; // <--- changed

    sound.pause(); // <--- changed
    sound.currentTime = 0; // <--- changed
    sound.volume = 0.10
    sound.play().catch(() => { // <--- changed
        // Browser may block audio until the user interacts with the page. // <--- changed
    }); // <--- changed
}

export default function TradingGame() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const phoneUnlockSoundRef = useRef<HTMLAudioElement | null>(null); // <--- changed
    const phoneLockSoundRef = useRef<HTMLAudioElement | null>(null); // <--- changed
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

    useEffect(() => { // <--- changed
        phoneUnlockSoundRef.current = new Audio(PHONE_UNLOCK_SOUND_PATH); // <--- changed
        phoneLockSoundRef.current = new Audio(PHONE_LOCK_SOUND_PATH); // <--- changed

        if (phoneUnlockSoundRef.current) { // <--- changed
            phoneUnlockSoundRef.current.preload = "auto"; // <--- changed
            phoneUnlockSoundRef.current.load(); // <--- changed
        }

        if (phoneLockSoundRef.current) { // <--- changed
            phoneLockSoundRef.current.preload = "auto"; // <--- changed
            phoneLockSoundRef.current.load(); // <--- changed
        }
    }, []); // <--- changed

    const [balance, setBalance] = useState(5000); // <--- changed
    const [timeframe, setTimeframe] = useState("15m");
    const [quantity, setQuantity] = useState(1);
    const [now, setNow] = useState(Date.now());
    const [isLandscape, setIsLandscape] = useState(false); // <--- changed
    const [mobilePhoneScale, setMobilePhoneScale] = useState(1); // <--- changed: phone stays fixed inside the full app stage
    const [appScale, setAppScale] = useState(1); // <--- changed: scales the entire app as one proportional object
    const [isDesktopStatusRender, setIsDesktopStatusRender] = useState(false); // <--- changed: desktop-only fake phone status bar polish
    const [settingsOpen, setSettingsOpen] = useState(false); // <--- changed
    const [phoneOpen, setPhoneOpen] = useState(false); // <--- changed
    const [phoneClosing, setPhoneClosing] = useState(false); // <--- changed
    const [activePhoneApp, setActivePhoneApp] = useState<"home" | "phone">("home"); // <--- changed
    const [phoneAppClosing, setPhoneAppClosing] = useState(false); // <--- changed
    const [dialedPhoneNumber, setDialedPhoneNumber] = useState(""); // <--- changed
    const [homeButtonAnimating, setHomeButtonAnimating] = useState(false); // <--- changed: locks home button while its press/close animation runs
    const [homeButtonHidden, setHomeButtonHidden] = useState(false); // <--- changed: keeps home bar faded until app close finishes
    const [cellStrength, setCellStrength] = useState(4); // <--- changed
    const [wifiStrength, setWifiStrength] = useState(3); // <--- changed
    const [locationServicesOn, setLocationServicesOn] = useState(true); // <--- changed
    const [batteryPercent, setBatteryPercent] = useState<number | null>(null); // <--- changed
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

    function openPhonePanel() {
        if (phoneOpen) return; // <--- changed

        playPhoneSound(phoneUnlockSoundRef); // <--- changed
        setPhoneClosing(false); // <--- changed
        setActivePhoneApp("home"); // <--- changed
        setPhoneAppClosing(false); // <--- changed
        setPhoneOpen(true); // <--- changed
    }

    function closePhonePanel() {
        if (!phoneOpen || phoneClosing) return; // <--- changed

        playPhoneSound(phoneLockSoundRef); // <--- changed
        setPhoneClosing(true); // <--- changed

        window.setTimeout(() => {
            setPhoneOpen(false); // <--- changed
            setPhoneClosing(false); // <--- changed
            setActivePhoneApp("home"); // <--- changed
            setPhoneAppClosing(false); // <--- changed
        }, 280);
    }

    function openFakePhoneApp() { // <--- changed
        setPhoneAppClosing(false); // <--- changed
        setActivePhoneApp("phone"); // <--- changed
    }

    function handlePhoneHomePress() { // <--- changed
        if (homeButtonAnimating) return; // <--- changed: prevents double-triggering while the home bar is fading back in

        const shouldCloseApp = activePhoneApp !== "home" && !phoneAppClosing; // <--- changed

        setHomeButtonAnimating(true); // <--- changed
        setHomeButtonHidden(false); // <--- changed

        window.setTimeout(() => {
            setHomeButtonHidden(true); // <--- changed: quick fade after it nudges upward
        }, 95); // <--- changed

        if (shouldCloseApp) { // <--- changed
            window.setTimeout(() => {
                setPhoneAppClosing(true); // <--- changed: app begins its slide-down close after the home bar press starts
            }, 115); // <--- changed

            window.setTimeout(() => {
                setActivePhoneApp("home"); // <--- changed
                setPhoneAppClosing(false); // <--- changed
                setHomeButtonAnimating(false); // <--- changed: removes the press/drop animation before fade-in starts
            }, 455); // <--- changed

            window.setTimeout(() => {
                setHomeButtonHidden(false); // <--- changed: fade the home bar back in from its normal starting position
            }, 475); // <--- changed

            window.setTimeout(() => {
                setHomeButtonAnimating(false); // <--- changed: functionality returns after fade-in finishes
            }, 920); // <--- changed: waits for the slower fade-in before unlocking

            return; // <--- changed
        }

        window.setTimeout(() => {
            setHomeButtonAnimating(false); // <--- changed: reset to the normal home bar position before fade-in
        }, 260); // <--- changed

        window.setTimeout(() => {
            setHomeButtonHidden(false); // <--- changed: fade in smoothly from the normal starting point
        }, 280); // <--- changed

        window.setTimeout(() => {
            setHomeButtonAnimating(false); // <--- changed
        }, 725); // <--- changed: waits for the slower fade-in before unlocking
    }

    function handlePhoneDigit(value: string) { // <--- changed
        if (!/^[0-9*#]$/.test(value)) return; // <--- changed: accepts digits plus * and #

        setDialedPhoneNumber((prev) => {
            const dialChars = prev.replace(/[^0-9*#]/g, "").slice(0, 10); // <--- changed
            if (dialChars.length >= 10) return dialChars; // <--- changed: hard cap at 10 dial characters
            return `${dialChars}${value}`.slice(0, 10); // <--- changed
        });
    }

    function handlePhoneDelete() { // <--- changed
        setDialedPhoneNumber((prev) => prev.replace(/[^0-9*#]/g, "").slice(0, 10).slice(0, -1)); // <--- changed
    }

    function handleFakeCall() { // <--- changed
        if (!dialedPhoneNumber) return; // <--- changed
        setDialedPhoneNumber("Calling..."); // <--- changed

        window.setTimeout(() => {
            setDialedPhoneNumber(""); // <--- changed
        }, 900); // <--- changed
    }

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

    function getCanvasLocalPoint(clientX: number, clientY: number) { // <--- changed: fixes click/drag hit detection when the full app is CSS-scaled
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;

        const canvasCssWidth = canvas.offsetWidth || rect.width;
        const canvasCssHeight = canvas.offsetHeight || rect.height;
        const scaleX = canvasCssWidth / rect.width;
        const scaleY = canvasCssHeight / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    function getCanvasPoint(event: ReactMouseEvent<HTMLCanvasElement>) {
        return getCanvasLocalPoint(event.clientX, event.clientY); // <--- changed
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
        const touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return null;

        return getCanvasLocalPoint(touch.clientX, touch.clientY); // <--- changed
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

    const displayedTimeframeGroupSize = getGroupSize(timeframe); // <--- changed: countdown now follows the candle that is actually displayed
    const completedInsideDisplayedCandle = market.active15mIndex % displayedTimeframeGroupSize; // <--- changed
    const displayedCandleDurationMs = displayedTimeframeGroupSize * base15mMs; // <--- changed
    const displayedCandleElapsedMs = completedInsideDisplayedCandle * base15mMs + elapsedInsideCurrent15m; // <--- changed
    const remainingMs = Math.max(
        0,
        displayedCandleDurationMs - displayedCandleElapsedMs
    ); // <--- changed: fixes 1h/4h countdown resetting before the visible candle closes

    const countdownText = formatCountdown(
        Math.ceil(Math.max(0, remainingMs) / 1000)
    );

    const marketDateTimeText = formatMarketDateTime(currentMarketTimestamp); // <--- changed
    const marketSessionText = `${getMarketSessionName(currentMarketTimestamp)} Session`; // <--- changed
    const phoneStatusTime = formatPhoneStatusTime(currentMarketTimestamp); // <--- changed

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now()); // <--- changed: keep UI clock alive; countdown is frozen by pause math
        }, 250);

        return () => clearInterval(timer);
    }, [simulationPaused]);

    useEffect(() => {
        const preventContextMenu = (event: Event) => event.preventDefault();

        const updateOrientationState = () => {
            const isPhoneSizedScreen =
                Math.min(window.innerWidth, window.innerHeight) <= 768; // <--- changed

            const nextAppScale = Math.min(
                window.innerWidth / GAME_BASE_WIDTH,
                window.innerHeight / GAME_BASE_HEIGHT,
                1
            ); // <--- changed: scale the whole app stage, not just the phone

            setAppScale(nextAppScale); // <--- changed
            setMobilePhoneScale(1.11); // <--- changed: phone remains PC-perfect inside the scaled app stage

            setIsLandscape(
                isPhoneSizedScreen && window.innerWidth > window.innerHeight
            ); // <--- changed: desktop PC should never show rotate blocker

            setIsDesktopStatusRender(true); // <--- changed: keep PC-perfect status bar styling; the full app now scales as one object
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
        const cellInterval = window.setInterval(() => {
            setCellStrength(Math.floor(Math.random() * 4) + 1); // <--- changed: service bars change on their own random rhythm
        }, 3800 + Math.floor(Math.random() * 2400));

        const wifiInterval = window.setInterval(() => {
            setWifiStrength(Math.floor(Math.random() * 2) + 2); // <--- changed: Wi-Fi changes separately and never drops below 2 bars
        }, 5200 + Math.floor(Math.random() * 3200));

        const locationInterval = window.setInterval(() => {
            setLocationServicesOn((prev) => (Math.random() > 0.45 ? !prev : prev)); // <--- changed: randomly toggles location services on/off
        }, 7000 + Math.floor(Math.random() * 5000));

        return () => {
            window.clearInterval(cellInterval);
            window.clearInterval(wifiInterval);
            window.clearInterval(locationInterval);
        };
    }, []);

    useEffect(() => {
        const fallbackBatteryInterval = window.setInterval(() => {
            const maybeNavigator = navigator as Navigator & {
                getBattery?: () => Promise<unknown>;
            };

            if (maybeNavigator.getBattery) return;

            setBatteryPercent((prev) => {
                const current = prev ?? 67;
                const drift = Math.random() > 0.7 ? -1 : 0;

                return Math.max(35, Math.min(100, current + drift));
            });
        }, 22000);

        return () => window.clearInterval(fallbackBatteryInterval);
    }, []);

    useEffect(() => {
        const maybeNavigator = navigator as Navigator & {
            getBattery?: () => Promise<{
                level: number;
                charging: boolean;
                addEventListener: (type: string, listener: () => void) => void;
                removeEventListener: (type: string, listener: () => void) => void;
            }>;
        };

        if (!maybeNavigator.getBattery) {
            setBatteryPercent(Math.floor(Math.random() * 46) + 45); // <--- changed: realistic fallback when browser blocks real battery info
            return;
        }

        let batteryRef:
            | {
                level: number;
                charging: boolean;
                addEventListener: (type: string, listener: () => void) => void;
                removeEventListener: (type: string, listener: () => void) => void;
            }
            | null = null;

        const updateBattery = () => {
            if (!batteryRef) return;

            setBatteryPercent(Math.round(batteryRef.level * 100));
        };

        maybeNavigator
            .getBattery()
            .then((battery) => {
                batteryRef = battery;
                updateBattery();

                battery.addEventListener("levelchange", updateBattery);
                battery.addEventListener("chargingchange", updateBattery);
            })
            .catch(() => {
                setBatteryPercent(Math.floor(Math.random() * 46) + 45); // <--- changed
            });

        return () => {
            if (!batteryRef) return;

            batteryRef.removeEventListener("levelchange", updateBattery);
            batteryRef.removeEventListener("chargingchange", updateBattery);
        };
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


    const phoneHomeApps: { name: string; bg: string; slotStyle?: CSSProperties; iconStyle?: CSSProperties; glyphStyle?: CSSProperties }[] = [ // <--- changed: static iPhone-style home screen apps
        {
            name: "Vitals", // <--- changed
            bg: "linear-gradient(145deg, #ff5a75, #f51646)", // <--- changed
            slotStyle: { gridColumn: "1 / span 2", gridRow: "1 / span 2", width: HOME_BIG_APP_SIZE }, // <--- changed
            iconStyle: { width: HOME_BIG_APP_SIZE, height: HOME_BIG_APP_SIZE, maxWidth: "none", maxHeight: "none", borderRadius: 24 }, // <--- changed
            glyphStyle: { fontSize: 42 }, // <--- changed
        },
        {
            name: "Investing", // <--- changed
            bg: "linear-gradient(145deg, #151515, #050505)", // <--- changed
            slotStyle: { gridColumn: "3 / span 2", gridRow: "1 / span 2", width: HOME_BIG_APP_SIZE }, // <--- changed
            iconStyle: { width: HOME_BIG_APP_SIZE, height: HOME_BIG_APP_SIZE, maxWidth: "none", maxHeight: "none", borderRadius: 24 }, // <--- changed
            glyphStyle: { fontSize: 42 }, // <--- changed
        },
        { name: "iTrade", bg: "transparent" },
        { name: "Centra", bg: "transparent" }, // <--- changed
        { name: "Locara", bg: "transparent" },
        { name: "Nest", bg: "transparent" }, // <--- changed
        { name: "Dashly", bg: "transparent" },
        { name: "Titan Gym", bg: "transparent" },
        { name: "Vaulté", bg: "transparent" },
        { name: "Throttle", bg: "transparent" },
        { name: "iLearn", bg: "transparent" }, // <--- changed
        { name: "Vanta", bg: "transparent" },
        { name: "Settings", bg: "transparent" }, // <--- changed
        { name: "App Hub", bg: "linear-gradient(145deg, #1f3d5d, #0b1c32)" },
    ];


    const phoneDockApps = [ // <--- changed: static bottom dock apps
        { name: "Phone", bg: "linear-gradient(180deg, #67f36f 0%, #11c43a 100%)", icon: "phone" }, // <--- changed
        { name: "Safari", bg: "linear-gradient(145deg, #ffffff 0%, #f3f3f3 55%, #e8e8e8 100%)", icon: "safari" }, // <--- changed
        { name: "Music", bg: "linear-gradient(180deg, #fb1f78 0%, #ff2f54 52%, #ff6a24 100%)", icon: "music" }, // <--- changed
        { name: "Messages", bg: "linear-gradient(180deg, #67f36f 0%, #11c43a 100%)", icon: "messages" }, // <--- changed
    ];

    return (
        <div style={styles.app}>
            <style>
                {`
                    @keyframes phoneSlideBounceIn {
                        0% { transform: translateY(115%); opacity: 0; }
                        70% { transform: translateY(-10px); opacity: 1; }
                        100% { transform: translateY(0); opacity: 1; }
                    }

                    @keyframes phoneSlideDownOut {
                        0% { transform: translateY(0); opacity: 1; }
                        100% { transform: translateY(120%); opacity: 0; }
                    }

                    @keyframes phoneBackdropIn {
                        0% { opacity: 0; backdrop-filter: blur(0px); }
                        100% { opacity: 1; backdrop-filter: blur(3px); }
                    }

                    @keyframes phoneBackdropOut {
                        0% { opacity: 1; backdrop-filter: blur(3px); }
                        100% { opacity: 0; backdrop-filter: blur(0px); }
                    }

                    @keyframes phoneAppExpandIn {
                        0% { transform: translateY(100%); opacity: 1; }
                        100% { transform: translateY(0); opacity: 1; }
                    }

                    @keyframes phoneAppSlideDownOut {
                        0% { transform: translateY(0); opacity: 1; }
                        100% { transform: translateY(112%); opacity: 0.92; }
                    }

                    @keyframes phoneHomeBarPressOut {
                        0% { transform: translateX(-50%) translateY(0); opacity: 1; }
                        35% { transform: translateX(-50%) translateY(-7px); opacity: 1; }
                        100% { transform: translateX(-50%) translateY(5px); opacity: 0; }
                    }
                `}
            </style>

            {isLandscape && ( // <--- changed
                <div style={styles.orientationBlocker}>
                    <div style={styles.orientationTitle}>Rotate Back</div>
                    <div style={styles.orientationText}>
                        This game is locked to portrait mode.
                    </div>
                </div>
            )}

            <div
                style={{
                    ...styles.appScaleFrame,
                    width: GAME_BASE_WIDTH * appScale, // <--- changed: reserves the scaled full-app footprint
                    height: GAME_BASE_HEIGHT * appScale, // <--- changed: reserves the scaled full-app footprint
                }}
            >
                <div
                    style={{
                        ...styles.appScaleObject,
                        transform: `scale(${appScale})`, // <--- changed: scales chart, buttons, phone, and overlays together
                    }}
                >
                    <div style={styles.gameFrame}>
                        {phoneOpen && ( // <--- changed
                            <div
                                style={{
                                    ...styles.phoneFocusLayer,
                                    ...(phoneClosing ? styles.phoneFocusLayerClosing : {}),
                                }}
                                onClick={closePhonePanel}
                            >
                                <div
                                    style={styles.phoneOutsideClickLayer}
                                    onClick={closePhonePanel}
                                >
                                    <div
                                        style={{
                                            ...styles.phoneScaleFrame,
                                            width: PHONE_BASE_WIDTH * mobilePhoneScale, // <--- changed: reserves scaled phone width
                                            height: PHONE_BASE_HEIGHT * mobilePhoneScale, // <--- changed: reserves scaled phone height
                                            marginTop: PHONE_VERTICAL_SHIFT, // <--- changed: placement stays outside scaling
                                            ...(phoneClosing ? styles.phonePanelClosing : {}),
                                        }}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <div
                                            style={{
                                                ...styles.phoneScaleObject,
                                                transform: `scale(${mobilePhoneScale})`, // <--- changed: scales phone shell + every child as one object
                                            }}
                                        >
                                            <div style={styles.phonePanel}>
                                                <div style={styles.phoneDevice}>
                                                    <div style={{ ...styles.phoneStatusBar, ...(isDesktopStatusRender ? styles.phoneStatusBarDesktop : {}) }}>
                                                        <div style={styles.phoneStatusLeft}>
                                                            <span>{phoneStatusTime}</span>

                                                            <span
                                                                style={{
                                                                    ...styles.phoneLocationSlot,
                                                                    opacity: locationServicesOn ? 1 : 0, // <--- changed: reserves space so time never shifts
                                                                }}
                                                                aria-hidden={!locationServicesOn}
                                                            >
                                                                <svg
                                                                    width="15"
                                                                    height="15"
                                                                    viewBox="0 0 24 24"
                                                                    style={styles.phoneLocationSvg}
                                                                    aria-label="Location services"
                                                                >
                                                                    <path
                                                                        d="M4.4 3.5L21.2 10.3C22.1 10.7 22 12 21 12.2L13.8 13.8L12.2 21C12 22 10.7 22.1 10.3 21.2L3.5 4.4C3.2 3.8 3.8 3.2 4.4 3.5Z"
                                                                        fill="currentColor"
                                                                    />
                                                                </svg>
                                                            </span>
                                                        </div>

                                                        <div style={styles.phoneDynamicIsland}>
                                                            <span style={styles.phoneCameraDot} />
                                                        </div>

                                                        <div style={styles.phoneStatusRight}>
                                                            <PhoneServiceSvg strength={cellStrength} /> {/* <--- changed: crisp SVG status icon */}
                                                            <PhoneWifiSvg strength={wifiStrength} /> {/* <--- changed: crisp SVG status icon */}
                                                            <PhoneBatterySvg percent={batteryPercent} /> {/* <--- changed: crisp SVG status icon */}
                                                        </div>                                    </div>

                                                    <div style={styles.phoneHomeScreen}> {/* <--- changed */}
                                                        <div style={styles.phoneAppGrid}> {/* <--- changed */}
                                                            {phoneHomeApps.map((app) => ( // <--- changed
                                                                <div key={app.name} style={{ ...styles.phoneAppSlot, ...app.slotStyle }}> {/* <--- changed */}
                                                                    <div
                                                                        style={{
                                                                            ...styles.phoneHomeAppIcon,
                                                                            background: app.bg,
                                                                            ...app.iconStyle, // <--- changed
                                                                        }}
                                                                    >
                                                                        {app.name === "Settings" ? ( // <--- changed
                                                                            <IPhoneSettingsIconSvg />
                                                                        ) : app.name === "iLearn" ? ( // <--- changed
                                                                            <IPhoneILearnIconSvg />
                                                                        ) : app.name === "Centra" ? ( // <--- changed
                                                                            <IPhoneCentraIconSvg />
                                                                        ) : app.name === "Nest" ? ( // <--- changed
                                                                            <IPhoneNestIconSvg />
                                                                        ) : app.name === "Dashly" ? ( // <--- changed
                                                                            <IPhoneDashlyIconSvg />
                                                                        ) : app.name === "App Hub" ? ( // <--- changed
                                                                            <IPhoneAppHubIconSvg />
                                                                        ) : app.name === "Titan Gym" ? ( // <--- changed
                                                                            <IPhoneTitanGymIconSvg />
                                                                        ) : app.name === "Locara" ? ( // <--- changed
                                                                            <IPhoneLocaraIconSvg />
                                                                        ) : app.name === "Throttle" ? ( // <--- changed
                                                                            <IPhoneThrottleIconSvg />
                                                                        ) : app.name === "Vaulte" || app.name === "Vault" || app.name === "Vaulté" ? ( // <--- changed
                                                                            <IPhoneVaulteIconSvg />
                                                                        ) : app.name === "Vanta" ? ( // <--- changed
                                                                            <IPhoneVantaIconSvg />
                                                                        ) : app.name === "iTrade" ? (
                                                                            <IPhoneITradeIconSvg />
                                                                        ) : (
                                                                            <span style={{ ...styles.phoneHomeAppGlyph, ...app.glyphStyle }}> {/* <--- changed */}
                                                                                {app.name.slice(0, 1)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div style={styles.phoneHomeAppName}>{app.name}</div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div style={styles.phoneSearchPill}> {/* <--- changed */}
                                                            <span style={styles.phoneSearchIcon}>⌕</span>
                                                            <span>Search</span>
                                                        </div>

                                                        <div style={styles.phoneDock}> {/* <--- changed */}
                                                            {phoneDockApps.map((app) => (
                                                                <div
                                                                    key={app.name}
                                                                    style={styles.phoneDockSlot}
                                                                    onClick={app.icon === "phone" ? openFakePhoneApp : undefined}
                                                                    role={app.icon === "phone" ? "button" : undefined}
                                                                    aria-label={app.icon === "phone" ? "Open Phone app" : undefined}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            ...styles.phoneDockAppIcon,
                                                                            background: app.bg,
                                                                        }}
                                                                    >
                                                                        {app.icon === "phone" ? ( // <--- changed
                                                                            <IPhonePhoneIconSvg />
                                                                        ) : app.icon === "safari" ? ( // <--- changed
                                                                            <IPhoneSafariIconSvg />
                                                                        ) : app.icon === "music" ? ( // <--- changed
                                                                            <IPhoneMusicIconSvg />
                                                                        ) : app.icon === "messages" ? ( // <--- changed
                                                                            <IPhoneMessagesIconSvg />
                                                                        ) : app.name === "Settings" ? ( // <--- changed
                                                                            <IPhoneSettingsIconSvg />
                                                                        ) : (
                                                                            <span style={styles.phoneHomeAppGlyph}>
                                                                                {app.name.slice(0, 1)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {activePhoneApp === "phone" && ( // <--- changed
                                                        <IPhonePhoneApp
                                                            dialedNumber={dialedPhoneNumber}
                                                            closing={phoneAppClosing}
                                                            onDigit={handlePhoneDigit}
                                                            onDelete={handlePhoneDelete}
                                                            onCall={handleFakeCall}
                                                        />
                                                    )}

                                                    <button
                                                        type="button"
                                                        style={{
                                                            ...styles.phoneHomeBarButton,
                                                            ...(homeButtonAnimating ? styles.phoneHomeBarButtonLocked : {}), // <--- changed
                                                        }}
                                                        onClick={handlePhoneHomePress}
                                                        aria-label={activePhoneApp === "phone" ? "Close Phone app" : "Home"}
                                                    >
                                                        <span
                                                            style={{
                                                                ...styles.phoneHomeBar,
                                                                ...(homeButtonAnimating ? styles.phoneHomeBarPressing : {}), // <--- changed
                                                                ...(homeButtonHidden ? styles.phoneHomeBarHidden : {}), // <--- changed
                                                            }}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

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

                        <div style={styles.marketTimeBlock}> {/* <--- changed */}
                            <div style={styles.phoneInlineAnchor}> {/* <--- changed */}
                                <button
                                    style={styles.phoneButton}
                                    onClick={openPhonePanel}
                                    aria-label="Open phone"
                                >
                                    <span style={styles.phoneButtonScreen}>
                                        <span style={styles.phoneButtonNotch} />
                                        <span style={styles.phoneButtonLine} />
                                    </span>
                                </button>

                            </div>

                            <div style={styles.marketTimeCenterColumn}> {/* <--- changed */}
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

                            <div style={styles.settingsInlineAnchor}> {/* <--- changed */}
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
    appScaleFrame: {
        width: GAME_BASE_WIDTH, // <--- changed
        height: GAME_BASE_HEIGHT, // <--- changed
        position: "relative", // <--- changed
        flexShrink: 0, // <--- changed
    },
    appScaleObject: {
        width: GAME_BASE_WIDTH, // <--- changed
        height: GAME_BASE_HEIGHT, // <--- changed
        position: "absolute", // <--- changed
        left: 0, // <--- changed
        top: 0, // <--- changed
        transformOrigin: "top left", // <--- changed: full app scales from one fixed design stage
    },
    gameFrame: {
        width: GAME_BASE_WIDTH, // <--- changed: fixed professional design-stage width
        height: GAME_BASE_HEIGHT, // <--- changed: fixed professional design-stage height
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
        fontSize: 11,
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
        position: "relative", // <--- changed
        background: "transparent", // <--- changed
        border: "none", // <--- changed
        padding: "8px 62px 6px", // <--- changed
        marginTop: "0px", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        textAlign: "center", // <--- changed
        overflow: "visible", // <--- changed
        minHeight: "auto", // <--- changed
        height: "auto", // <--- changed
        flexShrink: 0, // <--- changed
        width: "100%", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    marketTimeCenterColumn: {
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        gap: 2, // <--- changed
        textAlign: "center", // <--- changed
        lineHeight: 1, // <--- changed
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
        borderRadius: HOME_SEARCH_RADIUS, // <--- changed
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
    phoneInlineAnchor: {
        position: "absolute", // <--- changed
        left: 14, // <--- changed
        top: 28.5, // <--- changed: centers phone button with the middle market time line, like Wednesday 10:09 ET
        transform: "translateY(-50%)", // <--- changed
        zIndex: 60, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
    },
    settingsInlineAnchor: {
        position: "absolute", // <--- changed
        right: 14, // <--- changed
        top: "50%", // <--- changed
        transform: "translateY(-50%)", // <--- changed
        zIndex: 60, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
    },
    settingsButton: {
        width: 34, // <--- changed
        height: 34, // <--- changed
        borderRadius: 12, // <--- changed
        border: "none", // <--- changed // <--- changed
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
        border: "none", // <--- changed // <--- changed
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
        fontSize: 20, // <--- changed
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
        height: HOME_SEARCH_HEIGHT, // <--- changed
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
        borderRadius: 13, // <--- changed
        background: "rgba(255,255,255,0.055)", // <--- changed
        border: "none", // <--- changed // <--- changed
        padding: 12, // <--- changed
        marginBottom: 12, // <--- changed
    },
    settingsSectionTitle: {
        color: "#ffffff", // <--- changed
        fontSize: 11, // <--- changed
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
        gridTemplateColumns: "repeat(4, 1fr)", // <--- changed: four Phone app tabs only
        gap: 7, // <--- changed
    },
    timeframeToggle: {
        height: 32, // <--- changed
        borderRadius: 11, // <--- changed
        border: "none", // <--- changed // <--- changed
        background: "rgba(255,255,255,0.07)", // <--- changed
        color: "#808080", // <--- changed
        fontSize: 11, // <--- changed
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
        fontSize: 11, // <--- changed
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
    phoneButton: {
        position: "relative", // <--- changed
        width: 44, // <--- changed
        height: 44, // <--- changed
        borderRadius: 13, // <--- changed
        border: "none", // <--- changed // <--- changed
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
    phoneButtonScreen: {
        width: 19, // <--- changed
        height: 27, // <--- changed
        border: "2px solid #ffffff", // <--- changed
        borderRadius: 6, // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        position: "relative", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    phoneButtonNotch: {
        width: 7, // <--- changed
        height: 2, // <--- changed
        borderRadius: 99, // <--- changed
        background: "#ffffff", // <--- changed
        marginTop: 3, // <--- changed
    },
    phoneButtonLine: {
        position: "absolute", // <--- changed
        bottom: 3, // <--- changed
        width: 7, // <--- changed
        height: 2, // <--- changed
        borderRadius: 99, // <--- changed
        background: "rgba(255,255,255,0.75)", // <--- changed
    },
    phoneFocusLayer: {
        position: "absolute", // <--- changed
        inset: 0, // <--- changed
        zIndex: 500, // <--- changed: covers every row and blocks outside clicks
        background: "rgba(0,0,0,0.52)", // <--- changed
        backdropFilter: "blur(3px)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "stretch", // <--- changed
        justifyContent: "center", // <--- changed
        pointerEvents: "auto", // <--- changed
        animation: "phoneBackdropIn 420ms ease both", // <--- changed
    },
    phoneFocusLayerClosing: {
        animation: "phoneBackdropOut 280ms ease-in both", // <--- changed
    },
    phoneOutsideClickLayer: {
        position: "absolute", // <--- changed
        inset: 0, // <--- changed
        display: "flex", // <--- changed
        alignItems: "stretch", // <--- changed
        justifyContent: "center", // <--- changed
        pointerEvents: "auto", // <--- changed
    },
    phonePanel: {
        width: PHONE_BASE_WIDTH, // <--- changed: fixed PC-perfect phone width
        height: PHONE_BASE_HEIGHT, // <--- changed: fixed PC-perfect phone height
        position: "relative", // <--- changed
        pointerEvents: "auto", // <--- changed
    },
    phoneScaleFrame: {
        position: "relative", // <--- changed
        pointerEvents: "auto", // <--- changed
        animation: "phoneSlideBounceIn 420ms cubic-bezier(.2, .95, .2, 1) both", // <--- changed: animation lives here only
    },
    phoneScaleObject: {
        width: PHONE_BASE_WIDTH, // <--- changed
        height: PHONE_BASE_HEIGHT, // <--- changed
        position: "absolute", // <--- changed
        left: 0, // <--- changed
        top: 0, // <--- changed
        transformOrigin: "top left", // <--- changed: scale applies to the full fixed-size phone object
        pointerEvents: "auto", // <--- changed
    },
    phonePanelClosing: {
        animation: "phoneSlideDownOut 280ms ease-in both", // <--- changed
    },
    phoneDevice: {
        width: "100%", // <--- changed: fills fixed full phone object
        height: "100%", // <--- changed: fills fixed full phone object
        pointerEvents: "auto", // <--- changed
        borderRadius: "14% / 7%", border: "2px solid rgba(255,255,255,0.2)", // <--- changed
        background: "linear-gradient(180deg, #171717 0%, #050505 100%)", // <--- changed
        boxShadow: "0 28px 65px rgba(0,0,0,0.76)", // <--- changed
        position: "relative", // <--- changed
        overflow: "hidden", // <--- changed
        padding: "10px 10px 6px", // <--- changed: more bottom room for lower dock placement
        boxSizing: "border-box", // <--- changed
    },
    phoneStatusBar: {
        height: 44, // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "1fr 88px 1fr", // <--- changed: iPhone-style left / island / right alignment
        alignItems: "center", // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 13, // <--- changed
        fontWeight: 900, // <--- changed
        opacity: 0.96, // <--- changed
        position: "relative", // <--- changed
        zIndex: 11, // <--- changed: stays visible above full-screen app pages
        padding: "0 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    phoneStatusBarDesktop: {
        height: 32, // <--- changed: desktop-only status bar height
        padding: "0 16px", // <--- changed: desktop-only cleaner spacing
        WebkitFontSmoothing: "antialiased", // <--- changed
        textRendering: "geometricPrecision", // <--- changed
    },
    phoneStatusTimeDesktop: {
        fontSize: 13.5, // <--- changed: desktop-only larger time
        fontWeight: 850, // <--- changed
        letterSpacing: "-0.15px", // <--- changed
        opacity: 0.98, // <--- changed
    },
    phoneStatusIconsDesktop: {
        gap: 7, // <--- changed: desktop-only cleaner icon spacing
        opacity: 0.98, // <--- changed
    },
    phoneStatusIconDesktop: {
        opacity: 0.98, // <--- changed: no transform scaling; preserves crisp original sizing
    },
    phoneStatusLeft: {
        display: "flex", // <--- changed
        justifyContent: "center", // <--- changed
        alignItems: "center", // <--- changed
        gap: 5, // <--- changed
        letterSpacing: -0.45, // <--- changed
        paddingLeft: 3, // <--- changed
        fontSize: 15, // <--- changed
        fontWeight: 900, // <--- changed
        color: "#ffffff", // <--- changed
        lineHeight: "18px", // <--- changed: aligns time with status icons
    },
    phoneLocationSlot: {
        width: 15, // <--- changed: permanently reserves location icon space
        height: 15, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneLocationSvg: {
        color: "#ffffff", // <--- changed
        transform: "translateY(-1px) scaleX(-1) rotate(2deg)", // <--- changed: flipped horizontally
        display: "block", // <--- changed
        filter: "drop-shadow(0 0 1px rgba(0,0,0,0.25))", // <--- changed
    },
    phoneDynamicIsland: {
        width: 88, // <--- changed
        height: HOME_SEARCH_HEIGHT, // <--- changed
        borderRadius: HOME_SEARCH_RADIUS, // <--- changed
        background: "#000000", // <--- changed
        boxShadow: "none", // <--- changed // <--- changed
        justifySelf: "center", // <--- changed
        alignSelf: "center", // <--- changed
        position: "relative", // <--- changed
    },
    phoneCameraDot: {
        position: "absolute", // <--- changed
        right: 12, // <--- changed
        top: "50%", // <--- changed
        transform: "translateY(-50%)", // <--- changed
        width: 7, // <--- changed
        height: 7, // <--- changed
        borderRadius: 999, // <--- changed
        background: "radial-gradient(circle at 35% 35%, #203855, #03070d 70%)", // <--- changed
        boxShadow: "0 0 4px rgba(60,120,255,0.35)", // <--- changed
    },
    phoneStatusRight: {
        display: "flex", // <--- changed
        justifyContent: "flex-end", // <--- changed
        alignItems: "center", // <--- changed
        gap: 2, // <--- changed: closer to original iPhone-style spacing
        color: "#ffffff", // <--- changed
        height: 18, // <--- changed
        overflow: "visible", // <--- changed
        WebkitFontSmoothing: "antialiased", // <--- changed
        textRendering: "geometricPrecision", // <--- changed
    },
    statusSvg: {
        display: "block", // <--- changed
        color: "#ffffff", // <--- changed
        flexShrink: 0, // <--- changed
        height: 18, // <--- changed: normalizes status icon height
        overflow: "visible", // <--- changed
        shapeRendering: "geometricPrecision", // <--- changed: keeps Wi-Fi spacing consistent on PC and iPhone
        transform: "translateZ(0)", // <--- changed: reduces browser scaling differences
        filter: "drop-shadow(0 0 1px rgba(0,0,0,0.18))", // <--- changed
    },
    phoneHomeScreen: {
        height: "calc(100% - 44px)", // <--- changed: prevents apps from overlapping the top status region
        display: "block", // <--- changed: fixed positioning keeps PC + iPhone spacing identical
        padding: 0, // <--- changed
        boxSizing: "border-box", // <--- changed
        position: "relative", // <--- changed
        zIndex: 1, // <--- changed
        overflow: "hidden", // <--- changed: keeps apps/dock inside the phone screen
    },
    phoneAppGrid: {
        width: HOME_APP_GRID_WIDTH, // <--- changed: fixed grid width so Safari cannot stretch gaps
        maxWidth: "calc(100% - 28px)", // <--- changed: prevents left/right clipping inside phone
        display: "grid", // <--- changed
        gridTemplateColumns: `repeat(${HOME_APP_GRID_COLUMNS}, ${HOME_APP_SIZE}px)`, // <--- changed: exact app columns
        gridTemplateRows: `repeat(${HOME_APP_GRID_ROWS}, auto)`, // <--- changed: exact 5 rows
        columnGap: HOME_APP_GRID_GAP, // <--- changed: exact horizontal gap on PC + iPhone
        rowGap: HOME_APP_GRID_GAP, // <--- changed: exact vertical gap on PC + iPhone
        padding: 0, // <--- changed
        boxSizing: "border-box", // <--- changed
        position: "absolute", // <--- changed
        top: HOME_APP_GRID_VERTICAL_OFFSET, // <--- changed: app grid vertical knob
        left: "50%", // <--- changed
        transform: "translateX(-50%)", // <--- changed
        overflow: "visible", // <--- changed: prevents icon shadows from looking clipped
        minHeight: 0, // <--- changed
    },
    phoneAppSlot: {
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "flex-start", // <--- changed
        minWidth: 0, // <--- changed
    },
    phoneHomeAppIcon: {
        width: HOME_APP_SIZE, // <--- changed: app size knob
        height: HOME_APP_SIZE, // <--- changed: app size knob
        maxWidth: HOME_APP_SIZE, // <--- changed
        maxHeight: HOME_APP_SIZE, // <--- changed
        borderRadius: 13, // <--- changed
        boxShadow: "none", // <--- changed // <--- changed
        border: "none", // <--- changed // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        overflow: "hidden", // <--- changed
    },
    phoneDockAppIcon: {
        width: HOME_DOCK_APP_SIZE,
        height: HOME_DOCK_APP_SIZE,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        boxShadow: "0 8px 18px rgba(0,0,0,0.22)",
        flexShrink: 0,
    },

    phoneHomeAppGlyph: {
        color: "rgba(255,255,255,0.96)", // <--- changed
        fontSize: 19, // <--- changed
        fontWeight: 950, // <--- changed
        lineHeight: 1, // <--- changed
        textShadow: "0 1px 4px rgba(0,0,0,0.3)", // <--- changed
    },
    phoneHomeAppName: {
        color: "rgba(255,255,255,0.94)", // <--- changed
        fontSize: 9.5, // <--- changed
        fontWeight: 700, // <--- changed
        lineHeight: "11px", // <--- changed
        marginTop: 3, // <--- changed
        maxWidth: "100%", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
        whiteSpace: "nowrap", // <--- changed
        textShadow: "0 1px 2px rgba(0,0,0,0.5)", // <--- changed
    },
    phoneSearchPill: {
        width: HOME_SEARCH_WIDTH, // <--- changed
        height: HOME_SEARCH_HEIGHT, // <--- changed
        borderRadius: HOME_SEARCH_RADIUS, // <--- changed
        position: "absolute", // <--- changed: prevents iPhone Safari flex spacing drift
        left: "50%", // <--- changed
        bottom: HOME_DOCK_VERTICAL_OFFSET + HOME_DOCK_HEIGHT + HOME_SEARCH_VERTICAL_OFFSET, // <--- changed: follows freely moving dock
        transform: "translateX(-50%)", // <--- changed
        background: "rgba(255,255,255,0.22)", // <--- changed
        color: "rgba(255,255,255,0.86)", // <--- changed
        backdropFilter: "blur(12px)", // <--- changed
        WebkitBackdropFilter: "blur(12px)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        gap: 4, // <--- changed
        fontSize: 11, // <--- changed
        fontWeight: 800, // <--- changed
        boxShadow: "none", // <--- changed // <--- changed
    },
    phoneSearchIcon: {
        fontSize: 13, // <--- changed
        lineHeight: 1, // <--- changed
        transform: "translateY(-0.5px)", // <--- changed
    },
    phoneDock: {
        width: HOME_DOCK_WIDTH, // <--- changed: dock width knob
        height: HOME_DOCK_HEIGHT, // <--- changed: dock height knob
        borderRadius: HOME_DOCK_RADIUS, // <--- changed
        position: "absolute", // <--- changed: fixed dock placement on PC + iPhone
        left: "50%", // <--- changed
        bottom: HOME_DOCK_VERTICAL_OFFSET, // <--- changed: dock can move freely up/down
        transform: "translateX(-50%)", // <--- changed
        background: "rgba(255,255,255,0.18)", // <--- changed
        border: "none", // <--- changed // <--- changed
        backdropFilter: "blur(18px)", // <--- changed
        WebkitBackdropFilter: "blur(18px)", // <--- changed
        boxShadow: "none", // <--- changed // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: `repeat(${HOME_APP_GRID_COLUMNS}, ${HOME_DOCK_APP_SIZE}px)`, // <--- changed: exact dock app sizing
        columnGap: HOME_DOCK_APP_HORIZONTAL_GAP, // <--- changed: dock horizontal gap knob
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        justifyItems: "center", // <--- changed: keeps dock apps centered on iPhone
        padding: "9px 9px", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    phoneDockSlot: {
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneAppPage: { // <--- changed
        position: "absolute", // <--- changed
        left: 0, // <--- changed: fills the full phone screen width instead of looking like an inset square
        right: 0, // <--- changed: fills the full phone screen width instead of looking like an inset square
        top: 0, // <--- changed: page now expands across the full phone shell
        bottom: 0, // <--- changed: page now expands across the full phone shell
        paddingTop: 44, // <--- changed: leaves the time / Wi-Fi / island area visible above the app content
        paddingBottom: 34, // <--- changed: leaves the home bar area usable below the app content
        background: "#000000", // <--- changed
        color: "#ffffff", // <--- changed
        zIndex: 8, // <--- changed: below the status bar and home bar, above the home screen apps
        overflow: "hidden", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        boxSizing: "border-box", // <--- changed
        borderRadius: "inherit", // <--- changed: clips with the same rounded phone shell instead of a square card
        animation: "phoneAppExpandIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both", // <--- changed: smooth slide up with no bounce/readjust
        transformOrigin: "bottom center", // <--- changed
        WebkitFontSmoothing: "antialiased", // <--- changed
    },
    phoneAppPageClosing: { // <--- changed
        animation: "phoneAppSlideDownOut 320ms ease-in both", // <--- changed
    },
    phoneAppTopSpacer: { // <--- changed
        height: 10, // <--- changed: safe area is now handled by phoneAppPage paddingTop
        flexShrink: 0, // <--- changed
    },
    phoneDialerDisplayWrap: { // <--- changed
        width: "100%", // <--- changed
        height: 92, // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "flex-end", // <--- changed
        padding: "0 18px 10px", // <--- changed
        boxSizing: "border-box", // <--- changed
    },
    phoneDialerNumber: { // <--- changed
        color: "#ffffff", // <--- changed
        minHeight: 36, // <--- changed
        maxWidth: "100%", // <--- changed
        fontSize: 31, // <--- changed
        fontWeight: 400, // <--- changed
        letterSpacing: 0.6, // <--- changed
        lineHeight: "36px", // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneDialerAddNumber: { // <--- changed
        height: 22, // <--- changed
        background: "transparent", // <--- changed
        border: "none", // <--- changed
        color: "#0a84ff", // <--- changed
        fontSize: 14, // <--- changed
        fontWeight: 500, // <--- changed
        opacity: 0.98, // <--- changed
        cursor: "pointer", // <--- changed
    },
    phoneDialerKeypad: { // <--- changed
        width: 252, // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "repeat(3, 1fr)", // <--- changed
        gap: "12px 18px", // <--- changed
        justifyItems: "center", // <--- changed
        marginTop: 4, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneDialerKey: { // <--- changed
        width: 66, // <--- changed
        height: 66, // <--- changed
        borderRadius: 999, // <--- changed
        border: "none", // <--- changed
        background: "#333333", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", // <--- changed
        transition: "background 80ms ease", // <--- changed: quick iPhone-like press feedback
    },
    phoneDialerKeyPressed: { // <--- changed
        background: "#5f5f63", // <--- changed: light gray only while each key is actively pressed/flashed
    },
    phoneDialerKeyMain: { // <--- changed
        fontSize: 31, // <--- changed
        fontWeight: 400, // <--- changed
        lineHeight: "30px", // <--- changed
        transform: "translateY(1px)", // <--- changed
    },
    phoneDialerKeyMainCentered: { // <--- changed
        lineHeight: "66px", // <--- changed: visually centers keys with no small letter row, especially * and #
        transform: "translateY(0)", // <--- changed
    },
    phoneDialerKeyAsterisk: { // <--- changed
        fontSize: 38, // <--- changed: makes * as visually large as #
        lineHeight: "66px", // <--- changed
        transform: "translateY(5px)", // <--- changed: optical center for the asterisk glyph
    },
    phoneDialerKeySub: { // <--- changed
        minHeight: 11, // <--- changed
        color: "rgba(255,255,255,0.72)", // <--- changed
        fontSize: 9, // <--- changed
        fontWeight: 800, // <--- changed
        letterSpacing: 1.1, // <--- changed
        lineHeight: "11px", // <--- changed
    },
    phoneDialerActions: { // <--- changed
        width: 252, // <--- changed
        height: 76, // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "1fr 76px 1fr", // <--- changed
        alignItems: "center", // <--- changed
        justifyItems: "center", // <--- changed
        marginTop: 10, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneDialerSideAction: { // <--- changed
        width: 50, // <--- changed
        height: 50, // <--- changed
    },
    phoneDialerCallButton: { // <--- changed
        width: 68, // <--- changed
        height: 68, // <--- changed
        borderRadius: 999, // <--- changed
        border: "none", // <--- changed
        background: "#34c759", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        cursor: "pointer", // <--- changed
        transform: "none", // <--- changed: keeps the green call button handset facing the same direction as the iPhone Phone app icon
        overflow: "hidden", // <--- changed
    },
    phoneDialerDelete: { // <--- changed
        width: 54, // <--- changed
        height: 54, // <--- changed
        border: "none", // <--- changed
        background: "transparent", // <--- changed
        color: "rgba(255,255,255,0.78)", // <--- changed
        cursor: "pointer", // <--- changed
        transition: "opacity 160ms ease", // <--- changed
        display: "flex", // <--- changed: centers custom SVG consistently on PC and phone
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        padding: 0, // <--- changed: removes browser default button spacing
        WebkitAppearance: "none", // <--- changed: removes iOS button rendering differences
        appearance: "none", // <--- changed
        lineHeight: 1, // <--- changed
    },
    phoneDialerTabs: { // <--- changed
        position: "absolute", // <--- changed
        left: 0, // <--- changed
        right: 0, // <--- changed
        bottom: 0, // <--- changed: locks the tab bar to the bottom so it does not readjust after the app slide-in
        height: 76, // <--- changed: gray background still extends to the phone bottom
        borderTop: "1px solid rgba(255,255,255,0.12)", // <--- changed
        background: "rgba(14,14,14,0.96)", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "repeat(4, 1fr)", // <--- changed: four Phone app tabs only
        alignItems: "start", // <--- changed: prevents center recalculation after slide-in
        paddingTop: 8, // <--- changed: fixed final tab-row start position
        paddingBottom: 20, // <--- changed: keeps gray extension below the tab row
        boxSizing: "border-box", // <--- changed
        transform: "translateZ(0)", // <--- changed: locks compositor layer during app animation
        willChange: "transform", // <--- changed
    },
    phoneDialerTab: { // <--- changed
        color: "rgba(255,255,255,0.48)", // <--- changed
        width: "100%", // <--- changed
        height: 52, // <--- changed: exact same tab item box for every tab
        fontSize: 9.5, // <--- changed
        fontWeight: 600, // <--- changed
        display: "grid", // <--- changed
        gridTemplateRows: "26px 13px", // <--- changed: same icon box + same label box for all tabs
        alignItems: "center", // <--- changed
        justifyItems: "center", // <--- changed
        rowGap: 3, // <--- changed: consistent icon-to-label gap for every tab
        lineHeight: 1, // <--- changed
        transform: "translateZ(0)", // <--- changed
        backfaceVisibility: "hidden", // <--- changed
    },
    phoneDialerTabActive: { // <--- changed
        color: "#0a84ff", // <--- changed
    },
    phoneDialerTabIcon: { // <--- changed
        width: 26, // <--- changed: shared fixed icon slot
        height: 26, // <--- changed: shared fixed icon slot
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontSize: 19, // <--- changed
        lineHeight: "26px", // <--- changed
        fontWeight: 700, // <--- changed
        overflow: "hidden", // <--- changed
        transform: "translateY(0)", // <--- changed
    },
    phoneDialerTabLabel: { // <--- changed
        height: 13, // <--- changed
        display: "flex", // <--- changed
        fontSize: 9.5, // <--- changed
        lineHeight: "13px", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontWeight: 600, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        transform: "translateY(0)", // <--- changed
    },
    phoneHomeBarButton: { // <--- changed
        position: "absolute", // <--- changed
        left: 0, // <--- changed
        right: 0, // <--- changed
        bottom: 0, // <--- changed
        height: 34, // <--- changed
        zIndex: 12, // <--- changed
        border: "none", // <--- changed
        background: "transparent", // <--- changed
        padding: 0, // <--- changed
        margin: 0, // <--- changed
        cursor: "pointer", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneHomeBarButtonLocked: { // <--- changed
        pointerEvents: "none", // <--- changed: home button cannot work again until fade-in is finished
    },
    phoneHomeBar: {
        position: "absolute", // <--- changed
        left: "50%", // <--- changed
        bottom: PHONE_HOME_BAR_BOTTOM_OFFSET, // <--- changed: home bar vertical knob
        transform: "translateX(-50%)", // <--- changed
        width: 100, // <--- changed
        height: 4, // <--- changed
        borderRadius: 999, // <const HOME_SEARCH_VERTICAL_OFFSET--- changed
        background: "rgba(255,255,255,0.78)", // <--- changed
        opacity: 1, // <--- changed
        transition: "opacity 440ms ease, transform 180ms ease", // <--- changed: slightly slower smooth fade-in from resting position
    },
    phoneHomeBarPressing: { // <--- changed
        animation: "phoneHomeBarPressOut 260ms ease-in both", // <--- changed: moves up slightly, drops down, and fades quickly
    },
    phoneHomeBarHidden: { // <--- changed
        opacity: 0, // <--- changed
        transform: "translateX(-50%) translateY(0)", // <--- changed: hidden/fade-in starts from the normal resting position, not the dropped position
    },
    pauseButton: {
        position: "absolute", // <--- changed
        right: 16, // <--- changed
        bottom: 18, // <--- changed
        width: 44, // <--- changed
        height: 44, // <--- changed
        borderRadius: 13, // <--- changed
        border: "none", // <--- changed // <--- changed
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