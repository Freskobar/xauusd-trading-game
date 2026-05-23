import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type TouchEvent as ReactTouchEvent,
    type ReactNode,
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

const PHONE_HOME_ICON_PRELOAD_PATHS = [ // <--- changed: preloads PNG app icons before the fake phone opens
    centraBankIcon, // <--- changed
    nestIcon, // <--- changed
    settingsIcon, // <--- changed
    dashlyIcon, // <--- changed
    appHubIcon, // <--- changed
    titanGymIcon, // <--- changed
    locaraIcon, // <--- changed
    throttleIcon, // <--- changed
    vaulteIcon, // <--- changed
    vantaIcon, // <--- changed
    ilearnIcon, // <--- changed
    itradeIcon, // <--- changed
];

function preloadImageAsset(src: string) { // <--- changed
    return new Promise<void>((resolve) => { // <--- changed
        const image = new Image(); // <--- changed
        image.onload = () => resolve(); // <--- changed
        image.onerror = () => resolve(); // <--- changed: never block the phone forever if one asset is missing
        image.decoding = "async"; // <--- changed
        image.loading = "eager"; // <--- changed
        image.src = src; // <--- changed
    }); // <--- changed
}

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
const PENDING_BUTTON_BLUE = "#2f8cff"; // <--- restored: used by Pending Order button
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
        timeZone: MARKET_TIME_ZONE,
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


function getNewYorkClockParts(timestamp: number) { // <--- changed: single source of truth for candle/session time alignment
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(new Date(timestamp));

    return {
        hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
        minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
    };
}

function getMinutesSinceTradingDayOpen(timestamp: number) { // <--- changed: Daily candle now follows the market clock instead of app-start time
    const { hour, minute } = getNewYorkClockParts(timestamp); // <--- changed
    const minutes = hour * 60 + minute; // <--- changed
    const tradingDayOpenMinutes = 18 * 60; // <--- changed: aligns Daily/4H cycle with the 6 PM ET futures/forex-style session open

    return (minutes - tradingDayOpenMinutes + 24 * 60) % (24 * 60); // <--- changed
}

function getActive15mIndexFromTimestamp(timestamp: number) { // <--- changed: fixes 30m/1h/4H/Daily candle progress on initial load
    return Math.floor(getMinutesSinceTradingDayOpen(timestamp) / 15); // <--- changed
}

function formatMarketDateTime(timestamp: number) {
    const date = new Date(timestamp);

    const day = new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TIME_ZONE,
        weekday: "long",
    }).format(date);

    const time = new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(date);

    return `${day} ${time} ET`; // <--- changed
}

function formatPhoneStatusTime(timestamp: number) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TIME_ZONE,
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

const MARKET_TIME_ZONE = "America/New_York"; // <--- changed: one timezone source for display/session/candle boundaries
const CSV_TIMESTAMP_PARSE_ERROR = "CSV timestamp could not be parsed. The app is using the confirmed CSV timezone: America/New_York."; // <--- changed: no silent unknown-timezone guessing

function getTimeZoneOffsetMs(timeZone: string, timestamp: number) { // <--- changed: DST-safe timezone offset helper
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(new Date(timestamp));

    const values = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, Number(part.value)])
    ) as Record<string, number>;

    const zonedAsUtc = Date.UTC(
        values.year,
        (values.month ?? 1) - 1,
        values.day ?? 1,
        (values.hour ?? 0) % 24,
        values.minute ?? 0,
        values.second ?? 0
    );

    return zonedAsUtc - timestamp;
}

function zonedMarketTimeToUtcMs( // <--- changed: converts CSV wall-clock New York time into real UTC ms, including DST
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0
) {
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    let utcGuess = localAsUtc;

    for (let i = 0; i < 3; i++) {
        const offset = getTimeZoneOffsetMs(MARKET_TIME_ZONE, utcGuess);
        const nextGuess = localAsUtc - offset;

        if (Math.abs(nextGuess - utcGuess) < 1) {
            return nextGuess;
        }

        utcGuess = nextGuess;
    }

    return utcGuess;
}

function parseCsvTimestamp(value: string | undefined) {
    if (!value) return null;

    const cleaned = value.replace(/"/g, "").trim();
    if (!cleaned) return null;

    const normalized = cleaned.includes("T") ? cleaned : cleaned.replace(" ", "T"); // <--- changed
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized); // <--- changed

    if (hasExplicitTimezone) { // <--- changed: if the CSV ever includes Z/-04:00/+00:00, use that exact source data
        const direct = Date.parse(normalized); // <--- changed
        return Number.isFinite(direct) ? direct : null; // <--- changed
    }

    const parts = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/); // <--- changed: CSV format like 2025-05-14 00:00:00
    if (!parts) return null; // <--- changed

    const [, year, month, day, hour, minute, second = "0"] = parts; // <--- changed

    return zonedMarketTimeToUtcMs( // <--- changed: user-confirmed CSV timezone, DST-safe New York conversion
        Number(year),
        Number(month),
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
    );
}

function requireCsvTimestamp(value: string | undefined, rowLabel: string) { // <--- changed: validates CSV time while using user-confirmed New York timezone
    const timestamp = parseCsvTimestamp(value); // <--- changed

    if (timestamp === null) { // <--- changed
        throw new Error(`${CSV_TIMESTAMP_PARSE_ERROR} Problem row: ${rowLabel}. Raw time value: ${value ?? "blank"}`); // <--- changed
    }

    return timestamp; // <--- changed
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
// Example: Daily starts from the actual market-clock phase, not automatically from app launch. // <--- changed
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

function PhoneBatterySvg({ percent, black = false }: { percent: number | null; black?: boolean }) { // <--- changed
    const safePercent = Math.max(0, Math.min(100, percent ?? 67));
    const fillWidth = Math.max(2, Math.min(25, (safePercent / 100) * 25));
    const batteryShellColor = black ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.34)"; // <--- changed
    const batteryFillColor = black ? "#000000" : "rgba(255,255,255,0.96)"; // <--- changed
    const batteryTextColor = black ? "#ffffff" : "#050505"; // <--- changed

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
                fill={batteryShellColor}
            />

            <rect
                x="1"
                y="2.75"
                width={fillWidth}
                height="12.5"
                rx="0"
                fill={batteryFillColor}
                clipPath="url(#iphoneBatteryClipCrisp)"
            />

            <path
                d="M27.15 6.45H27.85C28.55 6.45 29 7.55 29 9C29 10.45 28.55 11.55 27.85 11.55H27.15Z"
                fill={batteryShellColor}
            />

            <text
                x="13.5"
                y="9.15"
                textAnchor="middle"
                dominantBaseline="middle" // <--- changed: keeps battery percentage vertically centered on mobile Safari
                alignmentBaseline="middle" // <--- changed: extra Safari/iOS alignment help
                fontSize="10.9" // <--- changed: fixed size so the whole phone scales as one object
                fontWeight="900"
                fill={batteryTextColor}
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
                d="M16.05 8.45L20.1 12.5M20.1 8.45L16.05 12.5"
                stroke="#ffffff" // <--- changed: slightly smaller centered white X
                strokeWidth="1.95" // <--- changed
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

function PhoneSearchTabIcon() { // <--- changed: clean magnifier with a small gap so the handle never overlaps the circle
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
                overflow: "visible", // <--- changed
            }}
        >
            <circle
                cx="10.45"
                cy="10.45"
                r="5.45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
            />
            <path
                d="M16.1 16.1L20.85 20.85"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
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
    const [phoneActiveTab, setPhoneActiveTab] = useState<"calls" | "contacts" | "keypad" | "search">("keypad"); // <--- changed: lets the bottom Phone tabs open separate pages
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

    const recentCalls = [ // <--- changed: premium-looking fake call history content for the new Calls page
        { name: "Jayden", type: "mobile", time: "Today", missed: false, initials: "J" },
        { name: "Unknown Caller", type: "No Caller ID", time: "Yesterday", missed: true, initials: "?" },
        { name: "Mia", type: "iPhone", time: "Sunday", missed: false, initials: "M" },
        { name: "Odyssey Support", type: "outgoing", time: "Friday", missed: false, initials: "O" },
        { name: "Alex", type: "mobile", time: "Thursday", missed: true, initials: "A" },
    ];

    const favoriteContacts = [ // <--- changed: polished fake contact content for the new Contacts page
        { name: "Jayden", label: "Mobile", initials: "J", accent: "blue" },
        { name: "Mia", label: "iPhone", initials: "M", accent: "pink" },
        { name: "Odyssey Support", label: "Business", initials: "O", accent: "green" },
    ];

    const contactGroups = [ // <--- changed: grouped contacts make the third Phone page feel real instead of empty
        {
            letter: "A", contacts: [
                { name: "Alex Rivera", label: "mobile", initials: "AR", accent: "orange" },
                { name: "Avery Stone", label: "iPhone", initials: "AS", accent: "purple" },
            ]
        },
        {
            letter: "J", contacts: [
                { name: "Jayden Brooks", label: "mobile", initials: "JB", accent: "blue" },
                { name: "Jordan Lee", label: "work", initials: "JL", accent: "gray" },
            ]
        },
        {
            letter: "M", contacts: [
                { name: "Mia Carter", label: "iPhone", initials: "MC", accent: "pink" },
                { name: "Mom", label: "home", initials: "M", accent: "green" },
            ]
        },
        {
            letter: "O", contacts: [
                { name: "Odyssey Support", label: "business", initials: "OS", accent: "green" },
            ]
        },
    ];

    const searchQuickActions = [ // <--- changed: polished quick actions for the fourth Phone page
        { label: "Missed", value: "2", tone: "red" },
        { label: "Favorites", value: "3", tone: "blue" },
        { label: "Business", value: "1", tone: "green" },
    ];

    const searchSuggestions = [ // <--- changed: realistic unified search results
        { title: "Jayden Brooks", subtitle: "Contact • mobile", initials: "JB", accent: "blue" },
        { title: "Mia Carter", subtitle: "Contact • iPhone", initials: "MC", accent: "pink" },
        { title: "Odyssey Support", subtitle: "Business • recent call", initials: "OS", accent: "green" },
        { title: "Unknown Caller", subtitle: "Recent missed call", initials: "?", accent: "red" },
    ];

    const tabs: Array<{ id: "calls" | "contacts" | "keypad" | "search"; icon: ReactNode; label: string }> = [
        { id: "calls", icon: <PhoneCallsTabIcon />, label: "Calls" }, // <--- changed: now opens the Calls page
        { id: "contacts", icon: <PhoneContactsTabIcon />, label: "Contacts" },
        { id: "keypad", icon: <PhoneKeypadTabIcon />, label: "Keypad" },
        { id: "search", icon: <PhoneSearchTabIcon />, label: "Search" },
    ];

    function renderCallsPage() { // <--- changed: second page shown when clicking Calls
        return (
            <div style={styles.phoneCallsPage}>
                <div style={styles.phoneCallsHeader}>
                    <div style={styles.phoneCallsEditText}>Edit</div>
                    <div style={styles.phoneCallsTitle}>Calls</div>
                    <button
                        type="button"
                        style={styles.phoneCallsPlusButton}
                        aria-label="Add call"
                    >
                        +
                    </button>
                </div>

                <div style={styles.phoneCallsSegment}>
                    <button type="button" style={{ ...styles.phoneCallsSegmentButton, ...styles.phoneCallsSegmentButtonActive }}>
                        All
                    </button>
                    <button type="button" style={styles.phoneCallsSegmentButton}>
                        Missed
                    </button>
                </div>

                <div style={styles.phoneCallsSummaryCard}>
                    <div style={styles.phoneCallsSummaryIcon}>
                        <PhoneCallsTabIcon />
                    </div>
                    <div style={styles.phoneCallsSummaryTextWrap}>
                        <div style={styles.phoneCallsSummaryTitle}>Recent Activity</div>
                        <div style={styles.phoneCallsSummarySub}>5 calls this week • 2 missed</div>
                    </div>
                </div>

                <div style={styles.phoneCallsList}>
                    <div style={styles.phoneCallsSectionTitle}>Recents</div>

                    {recentCalls.map((call, index) => (
                        <button
                            key={`${call.name}-${index}`}
                            type="button"
                            style={styles.phoneCallRow}
                        >
                            <div
                                style={{
                                    ...styles.phoneCallAvatar,
                                    ...(call.missed ? styles.phoneCallAvatarMissed : {}),
                                }}
                            >
                                {call.initials}
                            </div>

                            <div style={styles.phoneCallRowText}>
                                <div
                                    style={{
                                        ...styles.phoneCallName,
                                        ...(call.missed ? styles.phoneCallNameMissed : {}),
                                    }}
                                >
                                    {call.name}
                                </div>
                                <div style={styles.phoneCallType}>{call.type}</div>
                            </div>

                            <div style={styles.phoneCallMeta}>
                                <span style={styles.phoneCallTime}>{call.time}</span>
                                <span style={styles.phoneCallInfo}>i</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    function getContactAvatarStyle(accent: string) { // <--- changed: gives contact avatars a clean iOS-like colorful polish
        const avatarGradients: Record<string, string> = {
            blue: "linear-gradient(145deg, #5ac8fa, #0a84ff)",
            pink: "linear-gradient(145deg, #ff8ad8, #ff2d55)",
            green: "linear-gradient(145deg, #52d273, #30d158)",
            orange: "linear-gradient(145deg, #ffb340, #ff9f0a)",
            purple: "linear-gradient(145deg, #bf8cff, #7d5fff)",
            gray: "linear-gradient(145deg, #6f6f73, #3a3a3c)",
        };

        return {
            ...styles.phoneContactAvatar,
            background: avatarGradients[accent] ?? avatarGradients.gray,
        };
    }

    function getSearchActionStyle(tone: string) { // <--- changed: gives the Search page cards colorful iOS-style accents
        const actionGradients: Record<string, string> = {
            red: "linear-gradient(145deg, rgba(255,69,58,0.26), rgba(255,69,58,0.08))",
            blue: "linear-gradient(145deg, rgba(10,132,255,0.28), rgba(10,132,255,0.08))",
            green: "linear-gradient(145deg, rgba(48,209,88,0.24), rgba(48,209,88,0.08))",
        };

        return {
            ...styles.phoneSearchQuickCard,
            background: actionGradients[tone] ?? actionGradients.blue,
        };
    }

    function renderContactsPage() { // <--- changed: third page shown when clicking Contacts
        return (
            <div style={styles.phoneContactsPage}>
                <div style={styles.phoneContactsHeader}>
                    <div style={styles.phoneContactsTitleBlock}>
                        <div style={styles.phoneContactsTitle}>Contacts</div>
                        <div style={styles.phoneContactsCount}>8 saved contacts</div>
                    </div>
                    <button
                        type="button"
                        style={styles.phoneContactsPlusButton}
                        aria-label="Add contact"
                    >
                        +
                    </button>
                </div>

                <div style={styles.phoneContactsSearchBar}>
                    <PhoneSearchTabIcon />
                    <span style={styles.phoneContactsSearchText}>Search contacts</span>
                </div>

                <div style={styles.phoneContactsMeCard}>
                    <div style={styles.phoneContactsMeAvatar}>JA</div>
                    <div style={styles.phoneContactsMeText}>
                        <div style={styles.phoneContactsMeName}>Juan Acosta</div>
                        <div style={styles.phoneContactsMeSub}>My Card • iPhone</div>
                    </div>
                    <div style={styles.phoneContactsChevron}>›</div>
                </div>

                <div style={styles.phoneContactsFavoritesStrip}>
                    <div style={styles.phoneContactsSectionHeader}>Favorites</div>
                    <div style={styles.phoneContactsFavoriteRow}>
                        {favoriteContacts.map((contact) => (
                            <button
                                key={contact.name}
                                type="button"
                                style={styles.phoneContactsFavoriteCard}
                            >
                                <div style={getContactAvatarStyle(contact.accent)}>
                                    {contact.initials}
                                </div>
                                <div style={styles.phoneContactsFavoriteName}>{contact.name}</div>
                                <div style={styles.phoneContactsFavoriteLabel}>{contact.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={styles.phoneContactsList}>
                    {contactGroups.map((group) => (
                        <div key={group.letter} style={styles.phoneContactsGroup}>
                            <div style={styles.phoneContactsLetter}>{group.letter}</div>
                            {group.contacts.map((contact) => (
                                <button
                                    key={contact.name}
                                    type="button"
                                    style={styles.phoneContactRow}
                                >
                                    <div style={getContactAvatarStyle(contact.accent)}>
                                        {contact.initials}
                                    </div>
                                    <div style={styles.phoneContactText}>
                                        <div style={styles.phoneContactName}>{contact.name}</div>
                                        <div style={styles.phoneContactLabel}>{contact.label}</div>
                                    </div>
                                    <div style={styles.phoneContactsChevron}>›</div>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    function renderSearchPage() { // <--- changed: fourth page shown when clicking Search
        return (
            <div style={styles.phoneSearchPage}>
                <div style={styles.phoneSearchHeader}>
                    <div style={styles.phoneSearchTitle}>Search</div>
                    <div style={styles.phoneSearchSubtitle}>Find contacts, calls, and numbers</div>
                </div>

                <div style={styles.phoneSearchInputWrap}>
                    <span style={styles.phoneSearchInputIcon}>
                        <PhoneSearchTabIcon />
                    </span>
                    <span style={styles.phoneSearchInputText}>Name, phone number, or business</span>
                </div>

                <div style={styles.phoneSearchHeroCard}>
                    <div style={styles.phoneSearchHeroGlow} />
                    <div style={styles.phoneSearchHeroIcon}>
                        <PhoneSearchTabIcon />
                    </div>
                    <div style={styles.phoneSearchHeroText}>
                        <div style={styles.phoneSearchHeroTitle}>Smart Lookup</div>
                        <div style={styles.phoneSearchHeroSub}>Instantly search your fake phone history, saved contacts, and quick call shortcuts.</div>
                    </div>
                </div>

                <div style={styles.phoneSearchQuickGrid}>
                    {searchQuickActions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            style={getSearchActionStyle(action.tone)}
                        >
                            <div style={styles.phoneSearchQuickValue}>{action.value}</div>
                            <div style={styles.phoneSearchQuickLabel}>{action.label}</div>
                        </button>
                    ))}
                </div>

                <div style={styles.phoneSearchResultsCard}>
                    <div style={styles.phoneSearchSectionHeader}>Suggested Results</div>

                    {searchSuggestions.map((item) => (
                        <button
                            key={item.title}
                            type="button"
                            style={styles.phoneSearchResultRow}
                        >
                            <div style={getContactAvatarStyle(item.accent)}>
                                {item.initials}
                            </div>
                            <div style={styles.phoneSearchResultText}>
                                <div style={styles.phoneSearchResultTitle}>{item.title}</div>
                                <div style={styles.phoneSearchResultSub}>{item.subtitle}</div>
                            </div>
                            <div style={styles.phoneSearchResultAction}>Call</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    function renderKeypadPage() { // <--- changed: keeps the original keypad page intact
        return (
            <>
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
            </>
        );
    }


    return (
        <div
            style={{
                ...styles.phoneAppPage,
                ...(closing ? styles.phoneAppPageClosing : {}),
            }}
        >
            {phoneActiveTab === "calls" ? renderCallsPage() : null}
            {phoneActiveTab === "keypad" ? renderKeypadPage() : null}
            {phoneActiveTab === "contacts" ? renderContactsPage() : null}
            {phoneActiveTab === "search" ? renderSearchPage() : null}

            <div style={styles.phoneDialerTabs}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id} // <--- changed: tab is now clickable
                        type="button"
                        style={{
                            ...styles.phoneDialerTab,
                            ...(tab.id === phoneActiveTab ? styles.phoneDialerTabActive : {}),
                        }}
                        onClick={() => setPhoneActiveTab(tab.id)}
                    >
                        <span style={styles.phoneDialerTabIcon}>{tab.icon}</span>
                        <span style={styles.phoneDialerTabLabel}>{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}




type MusicTrack = { // <--- changed
    title: string;
    artist: string;
    album: string;
    file: string;
    src: string; // <--- changed: actual bundled audio URL
    color: string;
};

const MUSIC_APP_GRADIENTS = [ // <--- changed
    "linear-gradient(145deg, #ff2d55, #af52de)",
    "linear-gradient(145deg, #ff9f0a, #ff375f)",
    "linear-gradient(145deg, #5856d6, #007aff)",
    "linear-gradient(145deg, #30d158, #0a84ff)",
    "linear-gradient(145deg, #64d2ff, #bf5af2)",
    "linear-gradient(145deg, #ffd60a, #ff375f)",
];

// <--- changed: MAIN-SCRIPT-ONLY MUSIC LOADER
// This uses Vite's built-in import.meta.glob so the Music app is built from real audio files, not fake examples.
// Put your files here in the project: public/sounds/Music App/
// Supported names: Artist - Song.mp3, Artist - Song.m4a, Artist - Song.wav, Artist - Song.ogg
const MUSIC_APP_IMPORTED_FILES = import.meta.glob(
    "/public/sounds/Music App/*.{mp3,m4a,wav,ogg}",
    {
        eager: true,
        query: "?url",
        import: "default",
    }
) as Record<string, string>; // <--- changed

function cleanMusicFileName(value: string) { // <--- changed
    return decodeURIComponent(value)
        .replace(/\.(mp3|m4a|wav|ogg)$/i, "")
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildMusicTrackFromImportedFile(entry: [string, string], index: number): MusicTrack { // <--- changed
    const [path, src] = entry; // <--- changed
    const fileName = path.split("/").pop() ?? `Track ${index + 1}`; // <--- changed
    const cleanName = cleanMusicFileName(fileName); // <--- changed
    const parts = cleanName.split(" - "); // <--- changed
    const artist = parts.length >= 2 ? parts[0].trim() : "Unknown Artist"; // <--- changed
    const title = parts.length >= 2 ? parts.slice(1).join(" - ").trim() : cleanName; // <--- changed

    return { // <--- changed
        title: title || `Track ${index + 1}`,
        artist: artist || "Unknown Artist",
        album: "Music App",
        file: fileName,
        src,
        color: MUSIC_APP_GRADIENTS[index % MUSIC_APP_GRADIENTS.length],
    };
}

function loadMusicAppTracksFromMainScript() { // <--- changed
    return Object.entries(MUSIC_APP_IMPORTED_FILES)
        .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
        .map((entry, index) => buildMusicTrackFromImportedFile(entry, index)); // <--- changed
}

const EMPTY_MUSIC_TRACK: MusicTrack = { // <--- changed: only used for safe rendering when folder is empty
    title: "No Songs Found",
    artist: "Add audio files to public/sounds/Music App",
    album: "Music App",
    file: "",
    src: "",
    color: "linear-gradient(145deg, #3a3a3c, #1c1c1e)",
};

function getMusicTrackSrc(track: MusicTrack) { // <--- changed
    return track.src; // <--- changed
}

function formatMusicTime(seconds: number) { // <--- changed
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"; // <--- changed
    const minutes = Math.floor(seconds / 60); // <--- changed
    const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0"); // <--- changed
    return `${minutes}:${remainingSeconds}`; // <--- changed
}


let MUSIC_APP_PERSISTENT_AUDIO: HTMLAudioElement | null = null; // <--- changed: keeps music playing when phone closes
let MUSIC_APP_PERSISTENT_INDEX = 0; // <--- changed
let MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND = false; // <--- changed: pauses only while the real browser/app is minimized

function getMusicAppPersistentAudio() { // <--- changed
    if (typeof window === "undefined") return null; // <--- changed
    if (!MUSIC_APP_PERSISTENT_AUDIO) { // <--- changed
        MUSIC_APP_PERSISTENT_AUDIO = new Audio(); // <--- changed
        MUSIC_APP_PERSISTENT_AUDIO.preload = "auto"; // <--- changed
    } // <--- changed
    return MUSIC_APP_PERSISTENT_AUDIO; // <--- changed
}

function IPhoneMusicApp({ closing }: { closing: boolean }) { // <--- changed
    const audioRef = useRef<HTMLAudioElement | null>(getMusicAppPersistentAudio()); // <--- changed: persistent audio survives phone close
    const [selectedIndex, setSelectedIndex] = useState(() => MUSIC_APP_PERSISTENT_INDEX); // <--- changed
    const [isPlaying, setIsPlaying] = useState(() => Boolean(getMusicAppPersistentAudio() && !getMusicAppPersistentAudio()!.paused)); // <--- changed
    const [currentTime, setCurrentTime] = useState(() => getMusicAppPersistentAudio()?.currentTime ?? 0); // <--- changed
    const [duration, setDuration] = useState(() => { const audio = getMusicAppPersistentAudio(); return audio && Number.isFinite(audio.duration) ? audio.duration : 0; }); // <--- changed
    const [activeTab, setActiveTab] = useState<"library" | "listen" | "search">("library"); // <--- changed
    const [playerOpen, setPlayerOpen] = useState(false); // <--- changed
    const [searchValue, setSearchValue] = useState(""); // <--- changed
    const [musicTracks] = useState<MusicTrack[]>(() => loadMusicAppTracksFromMainScript()); // <--- changed: real songs loaded directly in this main TSX
    const [musicLibraryStatus] = useState(() => { // <--- changed
        const count = loadMusicAppTracksFromMainScript().length; // <--- changed
        return count > 0 ? `${count} songs loaded` : "No songs found in public/sounds/Music App"; // <--- changed
    }); // <--- changed

    if (!audioRef.current) audioRef.current = getMusicAppPersistentAudio(); // <--- changed

    const currentTrack = musicTracks[selectedIndex] ?? EMPTY_MUSIC_TRACK; // <--- changed
    const filteredTracks = musicTracks.filter((track) => { // <--- changed
        const query = searchValue.trim().toLowerCase(); // <--- changed
        if (!query) return true; // <--- changed
        return `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query); // <--- changed
    }); // <--- changed


    useEffect(() => { // <--- changed: pause music when the real phone/browser app is minimized, resume on return
        const handleVisibilityChange = () => { // <--- changed
            const audio = audioRef.current; // <--- changed
            if (!audio) return; // <--- changed

            if (document.hidden) { // <--- changed
                MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND = !audio.paused; // <--- changed
                if (!audio.paused) audio.pause(); // <--- changed
                return; // <--- changed
            } // <--- changed

            if (MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND) { // <--- changed
                MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND = false; // <--- changed
                audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); // <--- changed
            } // <--- changed
        }; // <--- changed

        const handlePageHide = () => { // <--- changed
            const audio = audioRef.current; // <--- changed
            if (!audio) return; // <--- changed
            MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND = !audio.paused; // <--- changed
            if (!audio.paused) audio.pause(); // <--- changed
        }; // <--- changed

        const handlePageShow = () => { // <--- changed
            const audio = audioRef.current; // <--- changed
            if (!audio || document.hidden) return; // <--- changed
            if (MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND) { // <--- changed
                MUSIC_APP_PAUSED_BY_REAL_APP_BACKGROUND = false; // <--- changed
                audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); // <--- changed
            } // <--- changed
        }; // <--- changed

        document.addEventListener("visibilitychange", handleVisibilityChange); // <--- changed
        window.addEventListener("pagehide", handlePageHide); // <--- changed
        window.addEventListener("pageshow", handlePageShow); // <--- changed

        return () => { // <--- changed
            document.removeEventListener("visibilitychange", handleVisibilityChange); // <--- changed
            window.removeEventListener("pagehide", handlePageHide); // <--- changed
            window.removeEventListener("pageshow", handlePageShow); // <--- changed
        }; // <--- changed
    }, []); // <--- changed

    useEffect(() => { // <--- changed
        const audio = audioRef.current; // <--- changed
        if (!audio) return; // <--- changed

        const updateTime = () => setCurrentTime(audio.currentTime || 0); // <--- changed
        const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0); // <--- changed
        const handleEnded = () => musicTracks.length > 0 ? playTrack((selectedIndex + 1) % musicTracks.length, true) : undefined; // <--- changed

        audio.addEventListener("timeupdate", updateTime); // <--- changed
        audio.addEventListener("loadedmetadata", updateDuration); // <--- changed
        audio.addEventListener("durationchange", updateDuration); // <--- changed
        audio.addEventListener("ended", handleEnded); // <--- changed

        return () => { // <--- changed
            audio.removeEventListener("timeupdate", updateTime); // <--- changed
            audio.removeEventListener("loadedmetadata", updateDuration); // <--- changed
            audio.removeEventListener("durationchange", updateDuration); // <--- changed
            audio.removeEventListener("ended", handleEnded); // <--- changed
        }; // <--- changed
    }, [selectedIndex]); // <--- changed

    useEffect(() => { // <--- changed
        const audio = audioRef.current; // <--- changed
        if (!audio || !currentTrack || !currentTrack.src) return; // <--- changed

        MUSIC_APP_PERSISTENT_INDEX = selectedIndex; // <--- changed
        const nextSrc = new URL(getMusicTrackSrc(currentTrack), window.location.href).href; // <--- changed

        if (audio.src !== nextSrc) { // <--- changed
            audio.src = nextSrc; // <--- changed
            audio.load(); // <--- changed
            setCurrentTime(0); // <--- changed
            setDuration(0); // <--- changed
        } else { // <--- changed
            setCurrentTime(audio.currentTime || 0); // <--- changed
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0); // <--- changed
            setIsPlaying(!audio.paused); // <--- changed
        } // <--- changed

        if (isPlaying || !audio.paused) { // <--- changed: remounting the phone does not pause music
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); // <--- changed
        } // <--- changed
    }, [selectedIndex]); // <--- changed

    function playTrack(index: number, forcePlay = true) { // <--- changed
        if (musicTracks.length === 0) return; // <--- changed
        const safeIndex = ((index % musicTracks.length) + musicTracks.length) % musicTracks.length; // <--- changed
        MUSIC_APP_PERSISTENT_INDEX = safeIndex; // <--- changed
        setSelectedIndex(safeIndex); // <--- changed
        if (forcePlay) setIsPlaying(true); // <--- changed

        window.setTimeout(() => { // <--- changed
            const audio = audioRef.current; // <--- changed
            if (!audio || !forcePlay) return; // <--- changed
            audio.play().catch(() => setIsPlaying(false)); // <--- changed
        }, 0); // <--- changed
    }

    function togglePlay() { // <--- changed
        const audio = audioRef.current; // <--- changed
        if (!audio || !currentTrack.src) return; // <--- changed

        if (isPlaying) { // <--- changed
            audio.pause(); // <--- changed
            setIsPlaying(false); // <--- changed
            return; // <--- changed
        } // <--- changed

        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); // <--- changed
    }

    function seekTo(value: number) { // <--- changed
        const audio = audioRef.current; // <--- changed
        if (!audio || !duration) return; // <--- changed
        const nextTime = (value / 100) * duration; // <--- changed
        audio.currentTime = nextTime; // <--- changed
        setCurrentTime(nextTime); // <--- changed
    }

    const progress = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0; // <--- changed

    const musicStyles: Record<string, CSSProperties> = { // <--- changed
        page: {
            ...styles.phoneAppPage,
            ...(closing ? styles.phoneAppPageClosing : {}),
            background: "linear-gradient(180deg, #19191d 0%, #0b0b0d 52%, #000000 100%)",
            color: "#ffffff",
            padding: "55px 16px 102px", // <--- changed
            overflow: "hidden",
        },
        scroll: {
            height: "100%",
            overflowY: "auto",
            paddingBottom: 102, // <--- changed
            scrollbarWidth: "none",
        },
        header: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
        },
        title: {
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: -1.2,
            lineHeight: 1,
        },
        profile: {
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "linear-gradient(145deg, #ff2d55, #ff9f0a)",
            display: "grid",
            placeItems: "center",
            fontSize: 13,
            fontWeight: 900,
            boxShadow: "0 10px 24px rgba(255, 45, 85, 0.35)",
        },
        hero: {
            position: "relative",
            borderRadius: 28,
            padding: 16,
            minHeight: 160,
            overflow: "hidden",
            background: currentTrack.color,
            boxShadow: "0 22px 50px rgba(0,0,0,0.42)",
            marginBottom: 18,
        },
        heroShade: {
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.28), transparent 34%), linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.58))",
        },
        heroTop: {
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            zIndex: 1,
        },
        heroKicker: {
            fontSize: 12,
            fontWeight: 800,
            opacity: 0.78,
            textTransform: "uppercase",
            letterSpacing: 1.3,
        },
        heroTitle: {
            position: "relative",
            zIndex: 1,
            marginTop: 45,
            fontSize: 27,
            lineHeight: 1.02,
            fontWeight: 950,
            letterSpacing: -0.9,
            maxWidth: 200,
        },
        heroSub: {
            position: "relative",
            zIndex: 1,
            marginTop: 6,
            fontSize: 13,
            color: "rgba(255,255,255,0.78)",
            fontWeight: 700,
        },
        playHero: {
            position: "relative",
            zIndex: 1,
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "none",
            background: "rgba(255,255,255,0.93)",
            color: "#111",
            fontSize: 18,
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
        },
        search: {
            height: 38,
            borderRadius: 14,
            background: "rgba(118,118,128,0.24)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            outline: "none",
            width: "100%",
            padding: "0 14px",
            fontSize: 14,
            fontWeight: 700,
            boxSizing: "border-box",
            marginBottom: 16,
        },
        sectionRow: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "0 2px 9px",
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: -0.4,
        },
        seeAll: {
            fontSize: 12,
            fontWeight: 800,
            color: "#ff375f",
        },
        card: {
            borderRadius: 22,
            background: "rgba(255,255,255,0.075)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            backdropFilter: "blur(16px)",
            marginBottom: 18,
        },
        emptyMusicMessage: { // <--- changed
            padding: "18px 16px",
            color: "rgba(255,255,255,0.68)",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.35,
        },
        row: {
            width: "100%",
            border: "none",
            background: "transparent",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            textAlign: "left",
            cursor: "pointer",
        },
        artwork: {
            width: 48,
            height: 48,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontSize: 20,
            fontWeight: 950,
            flexShrink: 0,
            boxShadow: "0 10px 22px rgba(0,0,0,0.26)",
        },
        rowText: {
            minWidth: 0,
            flex: 1,
        },
        trackTitle: {
            fontSize: 15,
            fontWeight: 850,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        trackArtist: {
            marginTop: 3,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.52)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        equalizer: {
            color: "#ff375f",
            fontSize: 13,
            fontWeight: 950,
            width: 30,
            textAlign: "right",
        },
        chips: {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 16,
        },
        chip: {
            borderRadius: 18,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 14,
            minHeight: 72,
        },
        chipIcon: {
            fontSize: 20,
            marginBottom: 8,
        },
        chipTitle: {
            fontSize: 13,
            fontWeight: 850,
        },
        mini: {
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 84, // <--- changed: sits cleanly above the 76px bottom tab row
            height: 58,
            borderRadius: 18,
            background: "rgba(36,36,39,0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 -10px 38px rgba(0,0,0,0.42)",
            backdropFilter: "blur(22px)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 10px",
            boxSizing: "border-box",
            zIndex: 25,
        },
        miniArtwork: {
            width: 42,
            height: 42,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            fontWeight: 950,
            flexShrink: 0,
        },
        miniText: {
            flex: 1,
            minWidth: 0,
            cursor: "pointer",
        },
        miniTitle: {
            fontSize: 13,
            fontWeight: 850,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        },
        miniArtist: {
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 700,
            marginTop: 2,
        },
        miniButton: {
            width: 31,
            height: 31,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: "#fff",
            fontSize: 18,
            fontWeight: 950,
            cursor: "pointer",
        },
        tabs: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 76, // <--- changed: same height as Phone app bottom tabs
            background: "rgba(18,18,20,0.88)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            paddingTop: 8, // <--- changed: matches Phone app tab row start
            zIndex: 24,
            paddingBottom: 20, // <--- changed: same lower padding as Phone app
            boxSizing: "border-box", // <--- changed
        },
        tabButton: {
            height: 52, // <--- changed: same tab item height as Phone app
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.48)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            fontSize: 10,
            fontWeight: 750,
            cursor: "pointer",
        },
        tabActive: {
            color: "#ff375f",
        },
        playerSheet: {
            position: "absolute",
            inset: 0,
            zIndex: 40,
            background: currentTrack.color,
            padding: "54px 22px 34px",
            boxSizing: "border-box",
            color: "#fff",
            animation: "phoneAppExpandIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        },
        playerOverlay: {
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.76))",
        },
        playerContent: {
            position: "relative",
            zIndex: 2,
            height: "100%",
            display: "flex",
            flexDirection: "column",
        },
        closePlayer: {
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "none",
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            fontSize: 22,
            fontWeight: 900,
            cursor: "pointer",
        },
        bigArt: {
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 30,
            margin: "42px 0 28px",
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.17)",
            boxShadow: "0 28px 70px rgba(0,0,0,0.38)",
            fontSize: 84,
            fontWeight: 950,
        },
        playerTrack: {
            fontSize: 24,
            fontWeight: 950,
            letterSpacing: -0.6,
        },
        playerArtist: {
            marginTop: 3,
            fontSize: 16,
            fontWeight: 800,
            color: "rgba(255,255,255,0.68)",
        },
        range: {
            width: "100%",
            accentColor: "#ffffff",
            marginTop: 22,
        },
        timeRow: {
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "rgba(255,255,255,0.62)",
            fontWeight: 750,
        },
        controls: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            marginTop: 24,
        },
        controlButton: {
            border: "none",
            background: "transparent",
            color: "#fff",
            fontSize: 28,
            fontWeight: 950,
            cursor: "pointer",
        },
        bigPlay: {
            width: 68,
            height: 68,
            borderRadius: 999,
            border: "none",
            background: "rgba(255,255,255,0.95)",
            color: "#111",
            fontSize: 28,
            fontWeight: 950,
            cursor: "pointer",
        },
    };

    function renderTrackRow(track: MusicTrack) { // <--- changed
        const index = musicTracks.indexOf(track); // <--- changed
        const selected = index === selectedIndex; // <--- changed

        return (
            <button key={track.file} type="button" style={musicStyles.row} onClick={() => playTrack(index, true)}>
                <div style={{ ...musicStyles.artwork, background: track.color }}>{track.title.slice(0, 1)}</div>
                <div style={musicStyles.rowText}>
                    <div style={{ ...musicStyles.trackTitle, color: selected ? "#ff375f" : "#fff" }}>{track.title}</div>
                    <div style={musicStyles.trackArtist}>{track.artist} • {track.album}</div>
                </div>
                <div style={musicStyles.equalizer}>{selected && isPlaying ? "▮▮▮" : "•••"}</div>
            </button>
        );
    }

    return (
        <div style={musicStyles.page}>
            {/* Persistent audio is outside the phone UI, so closing the phone will not stop music. */} {/* <--- changed */}
            <div style={musicStyles.scroll}>
                <div style={musicStyles.header}>
                    <div style={musicStyles.title}>{activeTab === "search" ? "Search" : activeTab === "listen" ? "Listen Now" : "Library"}</div>
                    <div style={musicStyles.profile}>JA</div>
                </div>

                {activeTab === "search" ? (
                    <>
                        <input
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                            placeholder="Artists, Songs, Lyrics, and More"
                            style={musicStyles.search}
                        />
                        <div style={musicStyles.sectionRow}>
                            <div style={musicStyles.sectionTitle}>Results</div>
                            <div style={musicStyles.seeAll}>{filteredTracks.length} songs</div>
                        </div>
                        <div style={musicStyles.card}>{filteredTracks.map(renderTrackRow)}</div>
                    </>
                ) : (
                    <>
                        <div style={musicStyles.hero}>
                            <div style={musicStyles.heroShade} />
                            <div style={musicStyles.heroTop}>
                                <div>
                                    <div style={musicStyles.heroKicker}>Now Playing</div>
                                </div>
                                <button type="button" style={musicStyles.playHero} onClick={togglePlay}>{isPlaying ? "Ⅱ" : "▶"}</button>
                            </div>
                            <div style={musicStyles.heroTitle}>{currentTrack.title}</div>
                            <div style={musicStyles.heroSub}>{currentTrack.artist} • From public/sounds/Music App</div>
                        </div>

                        <div style={musicStyles.chips}>
                            <div style={musicStyles.chip}><div style={musicStyles.chipIcon}>🎵</div><div style={musicStyles.chipTitle}>Songs</div></div>
                            <div style={musicStyles.chip}><div style={musicStyles.chipIcon}>💿</div><div style={musicStyles.chipTitle}>Albums</div></div>
                            <div style={musicStyles.chip}><div style={musicStyles.chipIcon}>⭐</div><div style={musicStyles.chipTitle}>Favorites</div></div>
                            <div style={musicStyles.chip}><div style={musicStyles.chipIcon}>⬇</div><div style={musicStyles.chipTitle}>Downloaded</div></div>
                        </div>

                        <div style={musicStyles.sectionRow}>
                            <div style={musicStyles.sectionTitle}>{activeTab === "listen" ? "Made For You" : "Recently Added"}</div>
                            <div style={musicStyles.seeAll}>See All</div>
                        </div>
                        {musicTracks.length === 0 ? ( // <--- changed
                            <div style={musicStyles.card}>
                                <div style={musicStyles.emptyMusicMessage}>{musicLibraryStatus}</div>
                            </div>
                        ) : ( // <--- changed
                            <div style={musicStyles.card}>{musicTracks.map(renderTrackRow)}</div>
                        )}
                    </>
                )}
            </div>

            <div style={musicStyles.mini}>
                <div style={{ ...musicStyles.miniArtwork, background: currentTrack.color }}>{currentTrack.title.slice(0, 1)}</div>
                <div style={musicStyles.miniText} onClick={() => setPlayerOpen(true)}>
                    <div style={musicStyles.miniTitle}>{currentTrack.title}</div>
                    <div style={musicStyles.miniArtist}>{currentTrack.artist}</div>
                </div>
                <button type="button" style={musicStyles.miniButton} onClick={togglePlay}>{isPlaying ? "Ⅱ" : "▶"}</button>
                <button type="button" style={musicStyles.miniButton} onClick={() => playTrack(selectedIndex + 1, isPlaying)}>›</button>
            </div>

            <div style={musicStyles.tabs}>
                {[
                    { id: "library", icon: "♫", label: "Library" },
                    { id: "listen", icon: "▶", label: "Listen Now" },
                    { id: "search", icon: "⌕", label: "Search" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        style={{ ...musicStyles.tabButton, ...(activeTab === tab.id ? musicStyles.tabActive : {}) }}
                        onClick={() => setActiveTab(tab.id as "library" | "listen" | "search")}
                    >
                        <span style={{ fontSize: 18 }}>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {playerOpen ? (
                <div style={musicStyles.playerSheet}>
                    <div style={musicStyles.playerOverlay} />
                    <div style={musicStyles.playerContent}>
                        <button type="button" style={musicStyles.closePlayer} onClick={() => setPlayerOpen(false)}>⌄</button>
                        <div style={musicStyles.bigArt}>{currentTrack.title.slice(0, 1)}</div>
                        <div style={musicStyles.playerTrack}>{currentTrack.title}</div>
                        <div style={musicStyles.playerArtist}>{currentTrack.artist}</div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={progress}
                            onChange={(event) => seekTo(Number(event.target.value))}
                            style={musicStyles.range}
                        />
                        <div style={musicStyles.timeRow}>
                            <span>{formatMusicTime(currentTime)}</span>
                            <span>-{formatMusicTime(Math.max(0, duration - currentTime))}</span>
                        </div>
                        <div style={musicStyles.controls}>
                            <button type="button" style={musicStyles.controlButton} onClick={() => playTrack(selectedIndex - 1, isPlaying)}>‹‹</button>
                            <button type="button" style={musicStyles.bigPlay} onClick={togglePlay}>{isPlaying ? "Ⅱ" : "▶"}</button>
                            <button type="button" style={musicStyles.controlButton} onClick={() => playTrack(selectedIndex + 1, isPlaying)}>››</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}



function IPhoneSafariApp({ closing }: { closing: boolean }) { // <--- changed
    const [addressText, setAddressText] = useState(""); // <--- changed
    const [googleText, setGoogleText] = useState(""); // <--- changed
    const [loadedSite, setLoadedSite] = useState(""); // <--- changed
    const [sourceType, setSourceType] = useState<"address" | "search" | null>(null); // <--- changed

    const safariStyles: Record<string, CSSProperties> = { // <--- changed: local styles prevent duplicate global style keys
        page: {
            background: "#f5f5f7",
            color: "#111",
            overflow: "hidden",
        },
        topBar: {
            position: "absolute",
            top: 66, // <--- changed: lowered clearly below Dynamic Island and status icons
            left: 0,
            right: 0,
            height: 42,
            padding: "0 13px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 4,
        },
        topButton: {
            width: 25,
            height: 25,
            borderRadius: 999,
            border: "none",
            background: "rgba(118,118,128,0.13)",
            color: "#007aff",
            display: "grid",
            placeItems: "center",
            fontSize: 17,
            fontWeight: 900,
            padding: 0,
            flexShrink: 0,
        },
        addressForm: {
            flex: 1,
            height: 32,
            borderRadius: 10,
            background: "rgba(118,118,128,0.13)",
            border: "1px solid rgba(60,60,67,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 9px",
            minWidth: 0,
        },
        addressIcon: {
            color: "rgba(60,60,67,0.45)",
            fontSize: 12,
            fontWeight: 900,
            flexShrink: 0,
        },
        addressInput: {
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#1d1d1f",
            fontSize: 11.5,
            fontWeight: 700,
            textAlign: "center",
            minWidth: 0,
        },
        refreshButton: {
            width: 18,
            height: 18,
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: "rgba(60,60,67,0.55)",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 900,
            padding: 0,
            flexShrink: 0,
        },
        content: {
            position: "absolute",
            top: 112, // <--- changed: content follows lowered Safari toolbar
            left: 0,
            right: 0,
            bottom: 76,
            overflow: "hidden",
            padding: "0 15px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
        },
        homeWrap: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 52, // <--- changed: keeps Google content balanced after lower Safari toolbar
        },
        googleLogo: {
            fontFamily: "Arial, sans-serif",
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1,
            marginBottom: 22,
        },
        googleSearchForm: {
            width: "100%",
            height: 46,
            borderRadius: 999,
            background: "#ffffff",
            boxShadow: "0 8px 26px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 15px",
            border: "1px solid rgba(0,0,0,0.05)",
        },
        googleIcon: {
            color: "rgba(60,60,67,0.48)",
            fontSize: 14,
            fontWeight: 900,
            flexShrink: 0,
        },
        googleInput: {
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#1d1d1f",
            fontSize: 13,
            fontWeight: 650,
            minWidth: 0,
        },
        homeMaintenanceCard: {
            width: "100%",
            marginTop: 38,
            borderRadius: 26,
            background: "#ffffff",
            boxShadow: "0 18px 42px rgba(0,0,0,0.11)",
            border: "1px solid rgba(0,0,0,0.05)",
            padding: "25px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 10,
        },
        badge: {
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "linear-gradient(145deg, #ff453a, #ff9f0a)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 25,
            fontWeight: 950,
            boxShadow: "0 12px 24px rgba(255,69,58,0.28)",
        },
        title: {
            color: "#111",
            fontSize: 17,
            fontWeight: 950,
            lineHeight: 1.08,
            textAlign: "center",
            maxWidth: 230,
        },
        body: {
            color: "rgba(60,60,67,0.72)",
            fontSize: 12.5,
            fontWeight: 650,
            lineHeight: 1.38,
            textAlign: "center",
            maxWidth: 230,
        },
        loadedWrap: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 18,
        },
        browserHeader: {
            fontSize: 11,
            fontWeight: 850,
            color: "rgba(60,60,67,0.54)",
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 12,
        },
        loadedCard: {
            width: "100%",
            minHeight: 315,
            borderRadius: 31,
            background: "#ffffff",
            boxShadow: "0 22px 55px rgba(0,0,0,0.14)",
            border: "1px solid rgba(0,0,0,0.05)",
            padding: "30px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 13,
        },
        largeBadge: {
            width: 62,
            height: 62,
            borderRadius: 20,
            background: "linear-gradient(145deg, #ff453a, #ff9f0a)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 36,
            fontWeight: 950,
            boxShadow: "0 16px 30px rgba(255,69,58,0.32)",
        },
        loadedTitle: {
            color: "#111",
            fontSize: 23,
            fontWeight: 950,
            lineHeight: 1.05,
            textAlign: "center",
            maxWidth: 255,
            overflowWrap: "anywhere",
        },
        loadedBody: {
            color: "rgba(60,60,67,0.74)",
            fontSize: 13,
            fontWeight: 650,
            lineHeight: 1.4,
            textAlign: "center",
            maxWidth: 245,
        },
        urlPill: {
            borderRadius: 15,
            background: "rgba(118,118,128,0.12)",
            color: "rgba(60,60,67,0.78)",
            fontSize: 11.5,
            fontWeight: 750,
            padding: "9px 12px",
            maxWidth: 245,
            overflowWrap: "anywhere",
        },
        backButton: {
            marginTop: 4,
            border: "none",
            borderRadius: 999,
            background: "#007aff",
            color: "#fff",
            fontSize: 13,
            fontWeight: 850,
            padding: "10px 18px",
            boxShadow: "0 12px 22px rgba(0,122,255,0.26)",
        },
        bottomBar: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0, // <--- changed: matches Phone app bottom row
            height: 76, // <--- changed: same height as Phone app bottom tabs
            padding: "8px 26px 20px", // <--- changed: same top/bottom spacing logic as Phone app
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            background: "rgba(245,245,247,0.88)",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            backdropFilter: "blur(18px)",
            zIndex: 5,
        },
        bottomButton: {
            width: 34, // <--- changed
            height: 42, // <--- changed: sits in same visual row as Phone app tabs
            border: "none",
            background: "transparent",
            color: "#007aff",
            fontSize: 18,
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            padding: 0,
        },
    };

    function cleanSite(value: string) { // <--- changed
        const trimmed = value.trim();
        if (!trimmed) return "";

        const cleaned = trimmed
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .replace(/\/.*$/, "")
            .trim();

        if (cleaned.includes(".")) return cleaned.toLowerCase();

        const compact = cleaned.toLowerCase().replace(/[^a-z0-9-]/g, "");
        return `${compact || "website"}.com`;
    }

    function fakeLoadFromAddress() { // <--- changed
        const site = cleanSite(addressText);
        if (!site) return;

        setAddressText(site);
        setLoadedSite(site);
        setSourceType("address");
    }

    function fakeLoadFromGoogle() { // <--- changed
        const site = cleanSite(googleText);
        if (!site) return;

        setLoadedSite(site);
        setSourceType("search");
    }

    function resetSafari() { // <--- changed
        setAddressText("");
        setGoogleText("");
        setLoadedSite("");
        setSourceType(null);
    }

    return (
        <div
            style={{
                ...styles.phoneAppPage,
                ...safariStyles.page,
                ...(closing ? styles.phoneAppPageClosing : {}),
            }}
        >
            <div style={safariStyles.topBar}>
                <button type="button" style={safariStyles.topButton} aria-label="Back">‹</button>

                <form
                    style={safariStyles.addressForm}
                    onSubmit={(event) => {
                        event.preventDefault();
                        fakeLoadFromAddress();
                    }}
                >
                    <span style={safariStyles.addressIcon}>⌕</span>
                    <input
                        style={safariStyles.addressInput}
                        value={addressText}
                        onChange={(event) => setAddressText(event.target.value)}
                        placeholder="Search or enter website"
                    />
                    <button
                        type="button"
                        style={safariStyles.refreshButton}
                        onClick={fakeLoadFromAddress}
                        aria-label="Load"
                    >
                        ↻
                    </button>
                </form>

                <button type="button" style={safariStyles.topButton} aria-label="Tabs">□</button>
            </div>

            <div style={safariStyles.content}>
                {!loadedSite ? (
                    <div style={safariStyles.homeWrap}>
                        <div style={safariStyles.googleLogo}>
                            <span style={{ color: "#4285f4" }}>G</span>
                            <span style={{ color: "#ea4335" }}>o</span>
                            <span style={{ color: "#fbbc05" }}>o</span>
                            <span style={{ color: "#4285f4" }}>g</span>
                            <span style={{ color: "#34a853" }}>l</span>
                            <span style={{ color: "#ea4335" }}>e</span>
                        </div>

                        <form
                            style={safariStyles.googleSearchForm}
                            onSubmit={(event) => {
                                event.preventDefault();
                                fakeLoadFromGoogle();
                            }}
                        >
                            <span style={safariStyles.googleIcon}>⌕</span>
                            <input
                                style={safariStyles.googleInput}
                                value={googleText}
                                onChange={(event) => setGoogleText(event.target.value)}
                                placeholder="Search Google or type a URL"
                            />
                        </form>

                        <div style={safariStyles.homeMaintenanceCard}>
                            <div style={safariStyles.badge}>!</div>
                            <div style={safariStyles.title}>Website is down for maintenance</div>
                            <div style={safariStyles.body}>
                                This browser preview is temporarily unavailable. Please try again later.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={safariStyles.loadedWrap}>
                        <div style={safariStyles.browserHeader}>Safari</div>

                        <div style={safariStyles.loadedCard}>
                            <div style={safariStyles.largeBadge}>!</div>
                            <div style={safariStyles.loadedTitle}>
                                {loadedSite} is currently down
                            </div>
                            <div style={safariStyles.loadedBody}>
                                {sourceType === "address"
                                    ? "Safari could not open this page because the website is temporarily under maintenance."
                                    : "Google Search reached the site, but the page is temporarily unavailable for scheduled maintenance."}
                            </div>
                            <div style={safariStyles.urlPill}>
                                Requested page: <strong>{loadedSite}</strong>
                            </div>
                            <button
                                type="button"
                                style={safariStyles.backButton}
                                onClick={resetSafari}
                            >
                                Back to Search
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div style={safariStyles.bottomBar}>
                <button type="button" style={safariStyles.bottomButton}>‹</button>
                <button type="button" style={safariStyles.bottomButton}>›</button>
                <button type="button" style={safariStyles.bottomButton}>＋</button>
                <button type="button" style={safariStyles.bottomButton}>☰</button>
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
    const phoneIconPreloadPromiseRef = useRef<Promise<void> | null>(null); // <--- changed
    const phoneIconsPreloadedRef = useRef(false); // <--- changed
    const phoneOpeningAfterPreloadRef = useRef(false); // <--- changed
    const homeSwipeStartYRef = useRef<number | null>(null); // <--- changed: real mobile swipe-up start position for home bar
    const homeSwipeDidTriggerRef = useRef(false); // <--- changed: stops one swipe from firing multiple times
    const appStartRef = useRef(Date.now());
    const fallbackMarketSessionStartRef = useRef(zonedMarketTimeToUtcMs(2026, 5, 18, 8, 30)); // <--- changed: DST-safe fallback market timestamp
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

    useEffect(() => { // <--- changed: starts loading all home-screen PNG icons as soon as the game mounts
        phoneIconPreloadPromiseRef.current = Promise.all(
            PHONE_HOME_ICON_PRELOAD_PATHS.map((src) => preloadImageAsset(src))
        ).then(() => { // <--- changed
            phoneIconsPreloadedRef.current = true; // <--- changed
        }); // <--- changed
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
    const [activePhoneApp, setActivePhoneApp] = useState<"home" | "phone" | "safari" | "music">("home"); // <--- changed
    const [phoneChromeVisualApp, setPhoneChromeVisualApp] = useState<"home" | "phone" | "safari" | "music">("home"); // <--- changed: status/home chrome color changes only while faded out
    const [phoneChromeFading, setPhoneChromeFading] = useState(false); // <--- changed: fades top phone chrome during app transitions
    const [musicAppKeepMounted, setMusicAppKeepMounted] = useState(false); // <--- changed: keeps Music mounted so songs continue playing
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
        if (phoneOpen || phoneOpeningAfterPreloadRef.current) return; // <--- changed

        const showPhonePanel = () => { // <--- changed
            phoneOpeningAfterPreloadRef.current = false; // <--- changed
            playPhoneSound(phoneUnlockSoundRef); // <--- changed
            setPhoneClosing(false); // <--- changed
            setActivePhoneApp("home"); // <--- changed
            setPhoneAppClosing(false); // <--- changed
            setPhoneOpen(true); // <--- changed
        }; // <--- changed

        if (!phoneIconsPreloadedRef.current && phoneIconPreloadPromiseRef.current) { // <--- changed: prevents visible icon pop-in on first open
            phoneOpeningAfterPreloadRef.current = true; // <--- changed
            phoneIconPreloadPromiseRef.current.then(showPhonePanel); // <--- changed
            return; // <--- changed
        }

        showPhonePanel(); // <--- changed
    }


    function transitionPhoneChromeTo(nextApp: "home" | "phone" | "safari" | "music", delayMs = 210) { // <--- changed
        setPhoneChromeFading(true); // <--- changed

        window.setTimeout(() => { // <--- changed
            setPhoneChromeVisualApp(nextApp); // <--- changed: color swaps while fully faded out
        }, delayMs); // <--- changed

        window.setTimeout(() => { // <--- changed
            setPhoneChromeFading(false); // <--- changed
        }, delayMs + 210); // <--- changed: slightly quicker fade-in so the status icons do not feel late
    }

    function closePhonePanel() {
        if (!phoneOpen || phoneClosing) return; // <--- changed

        playPhoneSound(phoneLockSoundRef); // <--- changed
        transitionPhoneChromeTo("home", 185); // <--- changed: quicker close-phone status fade
        setPhoneClosing(true); // <--- changed
        phoneOpeningAfterPreloadRef.current = false; // <--- changed

        window.setTimeout(() => {
            setPhoneOpen(false); // <--- changed
            setPhoneClosing(false); // <--- changed
            setActivePhoneApp("home"); // <--- changed
            setPhoneAppClosing(false); // <--- changed
        }, 280);
    }

    function openFakePhoneApp() { // <--- changed
        setPhoneAppClosing(false); // <--- changed
        transitionPhoneChromeTo("phone"); // <--- changed
        setActivePhoneApp("phone"); // <--- changed
    }

    function openFakeSafariApp() { // <--- changed
        setPhoneAppClosing(false); // <--- changed
        transitionPhoneChromeTo("safari"); // <--- changed
        setActivePhoneApp("safari"); // <--- changed
    }

    function openFakeMusicApp() { // <--- changed
        setPhoneAppClosing(false); // <--- changed
        setMusicAppKeepMounted(true); // <--- changed: once opened, keep mounted so audio keeps playing
        transitionPhoneChromeTo("music"); // <--- changed
        setActivePhoneApp("music"); // <--- changed
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
            transitionPhoneChromeTo("home", 210); // <--- changed: same smooth steps, slightly quicker so it does not feel late

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
                const activeCandleTimeMs = requireCsvTimestamp(rawNext.time, `CSV row ${history.nextIndex + 2}`); // <--- changed: strict CSV timestamp, no timezone guessing

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
                    status: `Loaded ${parsed.length.toLocaleString()} XAGUSD 15m candles • CSV time: New York`,
                    closedCandles,
                    activeCandle,
                    plannedCandle: planned,
                    dataIndex: history.nextIndex,
                    active15mIndex: getActive15mIndexFromTimestamp(activeCandleTimeMs), // <--- changed: start higher-timeframe candles at the correct market-clock phase
                    activeCandleTimeMs, // <--- changed
                });
            } catch (error) {
                console.error(error);

                const errorMessage = error instanceof Error ? error.message : String(error); // <--- changed
                if (errorMessage.includes(CSV_TIMESTAMP_PARSE_ERROR)) { // <--- changed: do not silently fake market time when the CSV is not timezone-aware
                    if (!cancelled) { // <--- changed
                        setMarket((prev) => ({ // <--- changed
                            ...prev, // <--- changed
                            loaded: false, // <--- changed
                            status: errorMessage, // <--- changed
                        })); // <--- changed
                    } // <--- changed
                    return; // <--- changed
                }

                const parsed = fallbackCandles();
                csvCandlesRef.current = parsed;

                const history = buildContinuousHistory(
                    parsed,
                    0,
                    HISTORY_BASE_CANDLES
                );

                const closedCandles = history.candles;
                const open = history.lastClose;
                const activeCandleTimeMs = fallbackMarketSessionStartRef.current; // <--- changed: fallback data has no CSV timestamps; only used when CSV fails to load

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
                    active15mIndex: getActive15mIndexFromTimestamp(activeCandleTimeMs), // <--- changed: fallback also respects the market-clock phase
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
                const nextCandleTimeMs = parseCsvTimestamp(nextRaw.time); // <--- changed: strict CSV timestamp, no synthetic +15m fallback

                if (nextCandleTimeMs === null) { // <--- changed
                    return { // <--- changed
                        ...prev, // <--- changed
                        status: `${CSV_TIMESTAMP_PARSE_ERROR} Problem row: CSV row ${nextIndex + 2}. Raw time value: ${nextRaw.time ?? "blank"}`, // <--- changed
                    }; // <--- changed
                }

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
                    active15mIndex: getActive15mIndexFromTimestamp(nextCandleTimeMs), // <--- changed: recalculate from the next CSV timestamp so gaps/DST/weekends stay aligned
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
            <div style={styles.phoneIconPreloadCache} aria-hidden="true"> {/* <--- changed: browser decodes the app PNGs before the phone is opened */}
                {PHONE_HOME_ICON_PRELOAD_PATHS.map((src) => ( // <--- changed
                    <img key={src} src={src} alt="" draggable={false} loading="eager" decoding="async" /> // <--- changed
                ))}
            </div>

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
                                                    <div
                                                        style={{
                                                            ...styles.phoneStatusBar,
                                                            ...(isDesktopStatusRender ? styles.phoneStatusBarDesktop : {}),
                                                            ...(phoneChromeVisualApp === "safari" ? styles.phoneSafariChromeBlack : {}), // <--- changed: Safari chrome color applies after fade swap
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                ...styles.phoneStatusLeft,
                                                                ...(phoneChromeVisualApp === "safari" ? { color: "#000000", textShadow: "none" } : {}),
                                                                ...(phoneChromeFading ? styles.phoneChromeFadeHidden : {}), // <--- changed: fade status details only, not Dynamic Island
                                                            }}
                                                        >
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
                                                                    style={{
                                                                        ...styles.phoneLocationSvg,
                                                                        ...(phoneChromeVisualApp === "safari" ? { color: "#000000", filter: "none" } : {}),
                                                                    }}
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

                                                        <div
                                                            style={{
                                                                ...styles.phoneStatusRight,
                                                                ...(phoneChromeVisualApp === "safari" ? { color: "#000000", filter: "none" } : {}),
                                                                ...(phoneChromeFading ? styles.phoneChromeFadeHidden : {}), // <--- changed: fade status details only, not Dynamic Island
                                                            }}>
                                                            <PhoneServiceSvg strength={cellStrength} /> {/* <--- changed: crisp SVG status icon */}
                                                            <PhoneWifiSvg strength={wifiStrength} /> {/* <--- changed: crisp SVG status icon */}
                                                            <PhoneBatterySvg percent={batteryPercent} black={phoneChromeVisualApp === "safari"} /> {/* <--- changed: battery switches black only in Safari */} {/* <--- changed: crisp SVG status icon */}
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
                                                                    onClick={app.icon === "phone" ? openFakePhoneApp : app.icon === "safari" ? openFakeSafariApp : app.icon === "music" ? openFakeMusicApp : undefined}
                                                                    role={app.icon === "phone" || app.icon === "safari" || app.icon === "music" ? "button" : undefined}
                                                                    aria-label={app.icon === "phone" ? "Open Phone app" : app.icon === "safari" ? "Open Safari app" : app.icon === "music" ? "Open Music app" : undefined}
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

                                                    {activePhoneApp === "safari" && ( // <--- changed
                                                        <IPhoneSafariApp closing={phoneAppClosing} />
                                                    )}

                                                    {musicAppKeepMounted && ( // <--- changed: keep mounted so audio continues after closing app/phone
                                                        <div
                                                            style={{
                                                                display: activePhoneApp === "music" ? "block" : "none",
                                                            }}
                                                        >
                                                            <IPhoneMusicApp closing={activePhoneApp === "music" && phoneAppClosing} />
                                                        </div>
                                                    )}

                                                    <button
                                                        type="button"
                                                        style={{
                                                            ...styles.phoneHomeBarButton,
                                                            ...(activePhoneApp === "safari"
                                                                ? {
                                                                    zIndex: 10050,
                                                                    pointerEvents: "auto",
                                                                }
                                                                : {}),
                                                            ...(homeButtonAnimating ? styles.phoneHomeBarButtonLocked : {}),
                                                        }}
                                                        onPointerDown={(event) => { // <--- changed: starts swipe-up detection on mobile and desktop
                                                            homeSwipeStartYRef.current = event.clientY; // <--- changed
                                                            homeSwipeDidTriggerRef.current = false; // <--- changed
                                                        }}
                                                        onPointerMove={(event) => { // <--- changed: swipe up on the home bar triggers the same animation
                                                            const startY = homeSwipeStartYRef.current; // <--- changed
                                                            if (startY === null || homeSwipeDidTriggerRef.current) return; // <--- changed

                                                            const swipeUpDistance = startY - event.clientY; // <--- changed
                                                            if (swipeUpDistance >= 18) { // <--- changed: low threshold so phone swipe feels responsive
                                                                homeSwipeDidTriggerRef.current = true; // <--- changed
                                                                handlePhoneHomePress(); // <--- changed
                                                            }
                                                        }}
                                                        onPointerUp={() => { // <--- changed: tap still works, swipe does not double-fire
                                                            const didSwipe = homeSwipeDidTriggerRef.current; // <--- changed
                                                            homeSwipeStartYRef.current = null; // <--- changed
                                                            homeSwipeDidTriggerRef.current = false; // <--- changed

                                                            if (!didSwipe) { // <--- changed
                                                                handlePhoneHomePress(); // <--- changed
                                                            } // <--- changed
                                                        }}
                                                        onPointerCancel={() => { // <--- changed
                                                            homeSwipeStartYRef.current = null; // <--- changed
                                                            homeSwipeDidTriggerRef.current = false; // <--- changed
                                                        }}
                                                        aria-label={activePhoneApp !== "home" ? "Close app" : "Home"}
                                                    >
                                                        <span
                                                            style={{
                                                                ...styles.phoneHomeBar,
                                                                ...(phoneChromeVisualApp === "safari"
                                                                    ? {
                                                                        background: "#000000",
                                                                        opacity: 1,
                                                                        boxShadow: "0 1px 8px rgba(0,0,0,0.25)",
                                                                    }
                                                                    : {}),
                                                                ...(homeButtonAnimating ? styles.phoneHomeBarPressing : {}),
                                                                ...(homeButtonHidden ? styles.phoneHomeBarHidden : {}),
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
    safariIframeWrap: { // <--- changed
        flex: 1,
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
        borderRadius: 0,
        background: "#ffffff",
        display: "flex",
    },
    safariIframe: { // <--- changed
        width: "100%",
        height: "100%",
        flex: 1,
        border: "none",
        background: "#ffffff",
        display: "block",
    },
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
    },
    phoneIconPreloadCache: { // <--- changed
        position: "fixed", // <--- changed
        left: -9999, // <--- changed
        top: -9999, // <--- changed
        width: 1, // <--- changed
        height: 1, // <--- changed
        overflow: "hidden", // <--- changed
        opacity: 0, // <--- changed
        pointerEvents: "none", // <--- changed
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
        transition: "opacity 210ms cubic-bezier(0.22, 1, 0.36, 1), color 100ms ease", // <--- changed
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
        transition: "opacity 210ms cubic-bezier(0.22, 1, 0.36, 1), color 100ms ease", // <--- changed
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
        border: "none", // <--- changed: removes default button border now that tabs are clickable
        background: "transparent", // <--- changed: removes default button fill now that tabs are clickable
        padding: 0, // <--- changed: keeps tab alignment identical after switching divs to buttons
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
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
    phoneCallsPage: { // <--- changed
        width: "100%", // <--- changed
        height: "100%", // <--- changed
        padding: "10px 18px 92px", // <--- changed
        boxSizing: "border-box", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "stretch", // <--- changed
        overflow: "hidden", // <--- changed
    },
    phoneCallsHeader: { // <--- changed
        height: 66, // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "64px 1fr 64px", // <--- changed
        alignItems: "center", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneCallsEditText: { // <--- changed
        color: "#0a84ff", // <--- changed
        fontSize: 16, // <--- changed
        fontWeight: 500, // <--- changed
        justifySelf: "start", // <--- changed
    },
    phoneCallsTitle: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 28, // <--- changed
        fontWeight: 800, // <--- changed
        letterSpacing: -0.7, // <--- changed
        justifySelf: "center", // <--- changed
    },
    phoneCallsPlusButton: { // <--- changed
        width: 34, // <--- changed
        height: 34, // <--- changed
        borderRadius: 999, // <--- changed
        border: "none", // <--- changed
        background: "rgba(10,132,255,0.18)", // <--- changed
        color: "#0a84ff", // <--- changed
        fontSize: 27, // <--- changed
        fontWeight: 400, // <--- changed
        lineHeight: "32px", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        justifySelf: "end", // <--- changed
        padding: 0, // <--- changed
        cursor: "pointer", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneCallsSegment: { // <--- changed
        height: 34, // <--- changed
        padding: 3, // <--- changed
        borderRadius: 10, // <--- changed
        background: "rgba(118,118,128,0.26)", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "1fr 1fr", // <--- changed
        gap: 3, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneCallsSegmentButton: { // <--- changed
        border: "none", // <--- changed
        borderRadius: 8, // <--- changed
        background: "transparent", // <--- changed
        color: "rgba(255,255,255,0.66)", // <--- changed
        fontSize: 13, // <--- changed
        fontWeight: 700, // <--- changed
        cursor: "pointer", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneCallsSegmentButtonActive: { // <--- changed
        background: "rgba(255,255,255,0.18)", // <--- changed
        color: "#ffffff", // <--- changed
        boxShadow: "0 1px 6px rgba(0,0,0,0.22)", // <--- changed
    },
    phoneCallsSummaryCard: { // <--- changed
        marginTop: 16, // <--- changed
        minHeight: 76, // <--- changed
        borderRadius: 22, // <--- changed
        background: "linear-gradient(135deg, rgba(10,132,255,0.28), rgba(52,199,89,0.16))", // <--- changed
        border: "1px solid rgba(255,255,255,0.1)", // <--- changed
        boxShadow: "0 14px 32px rgba(0,0,0,0.3)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        gap: 12, // <--- changed
        padding: "12px 14px", // <--- changed
        boxSizing: "border-box", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneCallsSummaryIcon: { // <--- changed
        width: 44, // <--- changed
        height: 44, // <--- changed
        borderRadius: 999, // <--- changed
        color: "#ffffff", // <--- changed
        background: "rgba(255,255,255,0.16)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneCallsSummaryTextWrap: { // <--- changed
        minWidth: 0, // <--- changed
        flex: 1, // <--- changed
    },
    phoneCallsSummaryTitle: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 16, // <--- changed
        fontWeight: 800, // <--- changed
        letterSpacing: -0.2, // <--- changed
    },
    phoneCallsSummarySub: { // <--- changed
        marginTop: 3, // <--- changed
        color: "rgba(255,255,255,0.62)", // <--- changed
        fontSize: 12.5, // <--- changed
        fontWeight: 600, // <--- changed
    },
    phoneCallsList: { // <--- changed
        marginTop: 18, // <--- changed
        borderRadius: 24, // <--- changed
        background: "rgba(28,28,30,0.88)", // <--- changed
        border: "1px solid rgba(255,255,255,0.08)", // <--- changed
        overflow: "hidden", // <--- changed
        flex: 1, // <--- changed
        minHeight: 0, // <--- changed
    },
    phoneCallsSectionTitle: { // <--- changed
        padding: "14px 14px 7px", // <--- changed
        color: "rgba(255,255,255,0.48)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 800, // <--- changed
        letterSpacing: 0.8, // <--- changed
        textTransform: "uppercase", // <--- changed
    },
    phoneCallRow: { // <--- changed
        width: "100%", // <--- changed
        minHeight: 64, // <--- changed
        border: "none", // <--- changed
        borderTop: "1px solid rgba(255,255,255,0.08)", // <--- changed
        background: "transparent", // <--- changed
        color: "#ffffff", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "42px 1fr auto", // <--- changed
        alignItems: "center", // <--- changed
        gap: 10, // <--- changed
        padding: "8px 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
        cursor: "pointer", // <--- changed
        textAlign: "left", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneCallAvatar: { // <--- changed
        width: 38, // <--- changed
        height: 38, // <--- changed
        borderRadius: 999, // <--- changed
        background: "linear-gradient(145deg, #3a3a3c, #1c1c1e)", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontSize: 15, // <--- changed
        fontWeight: 800, // <--- changed
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)", // <--- changed
    },
    phoneCallAvatarMissed: { // <--- changed
        background: "rgba(255,59,48,0.18)", // <--- changed
        color: "#ff453a", // <--- changed
    },
    phoneCallRowText: { // <--- changed
        minWidth: 0, // <--- changed
    },
    phoneCallName: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 15.5, // <--- changed
        fontWeight: 700, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneCallNameMissed: { // <--- changed
        color: "#ff453a", // <--- changed
    },
    phoneCallType: { // <--- changed
        marginTop: 3, // <--- changed
        color: "rgba(255,255,255,0.45)", // <--- changed
        fontSize: 12.5, // <--- changed
        fontWeight: 600, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneCallMeta: { // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        gap: 8, // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 700, // <--- changed
    },
    phoneCallTime: { // <--- changed
        whiteSpace: "nowrap", // <--- changed
    },
    phoneCallInfo: { // <--- changed
        width: 18, // <--- changed
        height: 18, // <--- changed
        borderRadius: 999, // <--- changed
        border: "1px solid rgba(10,132,255,0.9)", // <--- changed
        color: "#0a84ff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 800, // <--- changed
        fontFamily: "Georgia, serif", // <--- changed
        lineHeight: "18px", // <--- changed
    },
    phoneContactsPage: { // <--- changed
        width: "100%", // <--- changed
        height: "100%", // <--- changed
        padding: "14px 16px 92px", // <--- changed
        boxSizing: "border-box", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        overflow: "hidden", // <--- changed
    },
    phoneContactsHeader: { // <--- changed
        height: 70, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "space-between", // <--- changed
        gap: 14, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneContactsTitleBlock: { // <--- changed
        minWidth: 0, // <--- changed
    },
    phoneContactsTitle: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 32, // <--- changed
        fontWeight: 850, // <--- changed
        letterSpacing: -1.1, // <--- changed
        lineHeight: "36px", // <--- changed
    },
    phoneContactsCount: { // <--- changed
        marginTop: 2, // <--- changed
        color: "rgba(255,255,255,0.46)", // <--- changed
        fontSize: 12.5, // <--- changed
        fontWeight: 700, // <--- changed
    },
    phoneContactsPlusButton: { // <--- changed
        width: 36, // <--- changed
        height: 36, // <--- changed
        borderRadius: 999, // <--- changed
        border: "none", // <--- changed
        background: "rgba(10,132,255,0.18)", // <--- changed
        color: "#0a84ff", // <--- changed
        fontSize: 29, // <--- changed
        fontWeight: 400, // <--- changed
        lineHeight: "34px", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        padding: 0, // <--- changed
        cursor: "pointer", // <--- changed
        flexShrink: 0, // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneContactsSearchBar: { // <--- changed
        height: 38, // <--- changed
        borderRadius: 13, // <--- changed
        background: "rgba(118,118,128,0.24)", // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        gap: 7, // <--- changed
        padding: "0 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneContactsSearchText: { // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        fontSize: 15, // <--- changed
        fontWeight: 650, // <--- changed
    },
    phoneContactsMeCard: { // <--- changed
        marginTop: 14, // <--- changed
        minHeight: 72, // <--- changed
        borderRadius: 24, // <--- changed
        background: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))", // <--- changed
        border: "1px solid rgba(255,255,255,0.1)", // <--- changed
        boxShadow: "0 14px 34px rgba(0,0,0,0.24)", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "50px 1fr auto", // <--- changed
        alignItems: "center", // <--- changed
        gap: 12, // <--- changed
        padding: "11px 13px", // <--- changed
        boxSizing: "border-box", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneContactsMeAvatar: { // <--- changed
        width: 50, // <--- changed
        height: 50, // <--- changed
        borderRadius: 18, // <--- changed
        background: "linear-gradient(145deg, #0a84ff, #64d2ff)", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontSize: 17, // <--- changed
        fontWeight: 900, // <--- changed
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 18px rgba(10,132,255,0.24)", // <--- changed
    },
    phoneContactsMeText: { // <--- changed
        minWidth: 0, // <--- changed
    },
    phoneContactsMeName: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 16.5, // <--- changed
        fontWeight: 850, // <--- changed
        letterSpacing: -0.2, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneContactsMeSub: { // <--- changed
        marginTop: 4, // <--- changed
        color: "rgba(255,255,255,0.48)", // <--- changed
        fontSize: 12.5, // <--- changed
        fontWeight: 700, // <--- changed
    },
    phoneContactsChevron: { // <--- changed
        color: "rgba(255,255,255,0.34)", // <--- changed
        fontSize: 26, // <--- changed
        fontWeight: 300, // <--- changed
        lineHeight: "26px", // <--- changed
        transform: "translateY(-1px)", // <--- changed
    },
    phoneContactsFavoritesStrip: { // <--- changed
        marginTop: 16, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneContactsSectionHeader: { // <--- changed
        padding: "0 2px 8px", // <--- changed
        color: "rgba(255,255,255,0.48)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 850, // <--- changed
        letterSpacing: 0.7, // <--- changed
        textTransform: "uppercase", // <--- changed
    },
    phoneContactsFavoriteRow: { // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "repeat(3, 1fr)", // <--- changed
        gap: 9, // <--- changed
    },
    phoneContactsFavoriteCard: { // <--- changed
        minHeight: 104, // <--- changed
        border: "1px solid rgba(255,255,255,0.08)", // <--- changed
        borderRadius: 22, // <--- changed
        background: "rgba(28,28,30,0.84)", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        padding: "10px 6px", // <--- changed
        boxSizing: "border-box", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneContactsFavoriteName: { // <--- changed
        marginTop: 8, // <--- changed
        maxWidth: "100%", // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 12.5, // <--- changed
        fontWeight: 800, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneContactsFavoriteLabel: { // <--- changed
        marginTop: 2, // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        fontSize: 10.5, // <--- changed
        fontWeight: 700, // <--- changed
    },
    phoneContactsList: { // <--- changed
        marginTop: 16, // <--- changed
        borderRadius: 24, // <--- changed
        background: "rgba(28,28,30,0.88)", // <--- changed
        border: "1px solid rgba(255,255,255,0.08)", // <--- changed
        overflowX: "hidden", // <--- changed
        overflowY: "auto", // <--- changed
        flex: 1, // <--- changed
        minHeight: 0, // <--- changed
        WebkitOverflowScrolling: "touch", // <--- changed
    },
    phoneContactsGroup: { // <--- changed
        width: "100%", // <--- changed
    },
    phoneContactsLetter: { // <--- changed
        height: 26, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        padding: "0 14px", // <--- changed
        boxSizing: "border-box", // <--- changed
        color: "rgba(255,255,255,0.44)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: 0.7, // <--- changed
        background: "rgba(0,0,0,0.14)", // <--- changed
    },
    phoneContactRow: { // <--- changed
        width: "100%", // <--- changed
        minHeight: 60, // <--- changed
        border: "none", // <--- changed
        borderTop: "1px solid rgba(255,255,255,0.08)", // <--- changed
        background: "transparent", // <--- changed
        color: "#ffffff", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "40px 1fr auto", // <--- changed
        alignItems: "center", // <--- changed
        gap: 10, // <--- changed
        padding: "8px 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
        textAlign: "left", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneContactAvatar: { // <--- changed
        width: 38, // <--- changed
        height: 38, // <--- changed
        borderRadius: 14, // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontSize: 13, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: -0.2, // <--- changed
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24)", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneContactText: { // <--- changed
        minWidth: 0, // <--- changed
    },
    phoneContactName: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 15, // <--- changed
        fontWeight: 800, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneContactLabel: { // <--- changed
        marginTop: 3, // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 650, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneSearchPage: { // <--- changed
        width: "100%", // <--- changed
        height: "100%", // <--- changed
        padding: "18px 18px 92px", // <--- changed
        boxSizing: "border-box", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "stretch", // <--- changed
        overflow: "hidden", // <--- changed
    },
    phoneSearchHeader: { // <--- changed
        paddingTop: 12, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneSearchTitle: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 34, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: -1.2, // <--- changed
        lineHeight: "38px", // <--- changed
    },
    phoneSearchSubtitle: { // <--- changed
        marginTop: 3, // <--- changed
        color: "rgba(255,255,255,0.46)", // <--- changed
        fontSize: 13, // <--- changed
        fontWeight: 650, // <--- changed
    },
    phoneSearchInputWrap: { // <--- changed
        marginTop: 16, // <--- changed
        height: 42, // <--- changed
        borderRadius: 16, // <--- changed
        background: "rgba(118,118,128,0.26)", // <--- changed
        border: "1px solid rgba(255,255,255,0.06)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        gap: 8, // <--- changed
        padding: "0 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneSearchInputIcon: { // <--- changed
        width: 22, // <--- changed
        height: 22, // <--- changed
        color: "rgba(255,255,255,0.45)", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        transform: "scale(0.8)", // <--- changed
        transformOrigin: "center", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneSearchInputText: { // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        fontSize: 14, // <--- changed
        fontWeight: 650, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneSearchHeroCard: { // <--- changed
        position: "relative", // <--- changed
        marginTop: 16, // <--- changed
        minHeight: 112, // <--- changed
        borderRadius: 28, // <--- changed
        background: "linear-gradient(135deg, rgba(10,132,255,0.24), rgba(191,90,242,0.16), rgba(255,255,255,0.06))", // <--- changed
        border: "1px solid rgba(255,255,255,0.1)", // <--- changed
        boxShadow: "0 18px 38px rgba(0,0,0,0.32)", // <--- changed
        overflow: "hidden", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "52px 1fr", // <--- changed
        alignItems: "center", // <--- changed
        gap: 13, // <--- changed
        padding: "16px", // <--- changed
        boxSizing: "border-box", // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneSearchHeroGlow: { // <--- changed
        position: "absolute", // <--- changed
        right: -24, // <--- changed
        top: -30, // <--- changed
        width: 98, // <--- changed
        height: 98, // <--- changed
        borderRadius: 999, // <--- changed
        background: "rgba(100,210,255,0.22)", // <--- changed
        filter: "blur(10px)", // <--- changed
        pointerEvents: "none", // <--- changed
    },
    phoneSearchHeroIcon: { // <--- changed
        width: 52, // <--- changed
        height: 52, // <--- changed
        borderRadius: 18, // <--- changed
        background: "rgba(255,255,255,0.16)", // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        position: "relative", // <--- changed
        zIndex: 1, // <--- changed
    },
    phoneSearchHeroText: { // <--- changed
        minWidth: 0, // <--- changed
        position: "relative", // <--- changed
        zIndex: 1, // <--- changed
    },
    phoneSearchHeroTitle: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 17, // <--- changed
        fontWeight: 900, // <--- changed
        letterSpacing: -0.25, // <--- changed
    },
    phoneSearchHeroSub: { // <--- changed
        marginTop: 5, // <--- changed
        color: "rgba(255,255,255,0.58)", // <--- changed
        fontSize: 12.2, // <--- changed
        fontWeight: 650, // <--- changed
        lineHeight: "17px", // <--- changed
    },
    phoneSearchQuickGrid: { // <--- changed
        marginTop: 14, // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "repeat(3, 1fr)", // <--- changed
        gap: 9, // <--- changed
        flexShrink: 0, // <--- changed
    },
    phoneSearchQuickCard: { // <--- changed
        minHeight: 74, // <--- changed
        border: "1px solid rgba(255,255,255,0.08)", // <--- changed
        borderRadius: 20, // <--- changed
        color: "#ffffff", // <--- changed
        display: "flex", // <--- changed
        flexDirection: "column", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        padding: "8px 4px", // <--- changed
        boxSizing: "border-box", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneSearchQuickValue: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 23, // <--- changed
        fontWeight: 950, // <--- changed
        letterSpacing: -0.6, // <--- changed
        lineHeight: "25px", // <--- changed
    },
    phoneSearchQuickLabel: { // <--- changed
        marginTop: 5, // <--- changed
        color: "rgba(255,255,255,0.54)", // <--- changed
        fontSize: 10.5, // <--- changed
        fontWeight: 800, // <--- changed
        whiteSpace: "nowrap", // <--- changed
    },
    phoneSearchResultsCard: { // <--- changed
        marginTop: 16, // <--- changed
        borderRadius: 24, // <--- changed
        background: "rgba(28,28,30,0.88)", // <--- changed
        border: "1px solid rgba(255,255,255,0.08)", // <--- changed
        overflowX: "hidden", // <--- changed
        overflowY: "auto", // <--- changed
        flex: 1, // <--- changed
        minHeight: 0, // <--- changed
        WebkitOverflowScrolling: "touch", // <--- changed
    },
    phoneSearchSectionHeader: { // <--- changed
        padding: "14px 14px 7px", // <--- changed
        color: "rgba(255,255,255,0.48)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 850, // <--- changed
        letterSpacing: 0.7, // <--- changed
        textTransform: "uppercase", // <--- changed
    },
    phoneSearchResultRow: { // <--- changed
        width: "100%", // <--- changed
        minHeight: 62, // <--- changed
        border: "none", // <--- changed
        borderTop: "1px solid rgba(255,255,255,0.08)", // <--- changed
        background: "transparent", // <--- changed
        color: "#ffffff", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "40px 1fr auto", // <--- changed
        alignItems: "center", // <--- changed
        gap: 10, // <--- changed
        padding: "8px 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
        textAlign: "left", // <--- changed
        cursor: "pointer", // <--- changed
        WebkitAppearance: "none", // <--- changed
        appearance: "none", // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    phoneSearchResultText: { // <--- changed
        minWidth: 0, // <--- changed
    },
    phoneSearchResultTitle: { // <--- changed
        color: "#ffffff", // <--- changed
        fontSize: 15, // <--- changed
        fontWeight: 850, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneSearchResultSub: { // <--- changed
        marginTop: 3, // <--- changed
        color: "rgba(255,255,255,0.42)", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 650, // <--- changed
        whiteSpace: "nowrap", // <--- changed
        overflow: "hidden", // <--- changed
        textOverflow: "ellipsis", // <--- changed
    },
    phoneSearchResultAction: { // <--- changed
        minWidth: 42, // <--- changed
        height: 27, // <--- changed
        borderRadius: 999, // <--- changed
        background: "rgba(10,132,255,0.16)", // <--- changed
        color: "#0a84ff", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        fontSize: 12, // <--- changed
        fontWeight: 850, // <--- changed
        padding: "0 10px", // <--- changed
        boxSizing: "border-box", // <--- changed
    },

    safariAppPage: { // <--- changed
        background: "#ffffff", // <--- changed
        color: "#111111", // <--- changed
        overflow: "hidden", // <--- changed
    },
    safariStatusSearchBar: { // <--- changed
        position: "absolute", // <--- changed
        top: 44, // <--- changed
        left: 0, // <--- changed
        right: 0, // <--- changed
        height: 54, // <--- changed
        padding: "7px 12px", // <--- changed
        boxSizing: "border-box", // <--- changed
        display: "grid", // <--- changed
        gridTemplateColumns: "32px 1fr 32px", // <--- changed
        gap: 8, // <--- changed
        alignItems: "center", // <--- changed
        background: "rgba(255,255,255,0.92)", // <--- changed
        borderBottom: "1px solid rgba(0,0,0,0.08)", // <--- changed
        backdropFilter: "blur(18px)", // <--- changed
        zIndex: 4, // <--- changed
    },
    safariChromeButton: { // <--- changed
        width: 32, // <--- changed
        height: 32, // <--- changed
        border: "none", // <--- changed
        borderRadius: 999, // <--- changed
        background: "rgba(0,0,0,0.055)", // <--- changed
        color: "#1d1d1f", // <--- changed
        fontSize: 24, // <--- changed
        fontWeight: 750, // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        justifyContent: "center", // <--- changed
        cursor: "pointer", // <--- changed
        padding: 0, // <--- changed
        WebkitTapHighlightColor: "transparent", // <--- changed
    },
    safariMiniAddressBar: { // <--- changed
        height: 36, // <--- changed
        borderRadius: 999, // <--- changed
        background: "#f1f3f4", // <--- changed
        display: "flex", // <--- changed
        alignItems: "center", // <--- changed
        gap: 7, // <--- changed
        padding: "0 10px", // <--- changed
        boxSizing: "border-box", // <--- changed
        minWidth: 0, // <--- changed
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)", // <--- changed
    },
    safariMiniSearchIcon: { // <--- changed
        color: "#6b7280", // <--- changed
        fontSize: 18, // <--- changed
        fontWeight: 900, // <--- changed
        transform: "translateY(-0.5px)", // <--- changed
        flexShrink: 0, // <--- changed
    },
    safariMiniAddressInput: { // <--- changed
        flex: 1, // <--- changed
        minWidth: 0, // <--- changed
        height: "100%", // <--- changed
        border: "none", // <--- changed
        outline: "none", // <--- changed
        background: "transparent", // <--- changed
        color: "#202124", // <--- changed
        fontSize: 12.5, // <--- changed
        fontWeight: 650, // <--- changed
        fontFamily: "Arial, sans-serif", // <--- changed
    },
    safariGoogleContent: { // <--- changed
        position: "absolute", // <--- changed
        top: 98, // <--- changed
        left: 0, // <--- changed
        right: 0, // <--- changed
        bottom: 76, // <--- changed: matches the Phone app bottom bar height
        overflowY: "auto", // <--- changed
        WebkitOverflowScrolling: "touch", // <--- changed
        padding: "30px 17px 24px", // <--- changed
        boxSizing: "border-box", // <--- changed
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", // <--- changed
    }, safariRefreshIconButton: { // <--- changed
        border: "none",
        background: "transparent",
        color: "rgba(255,255,255,0.68)",
        fontSize: 13,
        fontWeight: 900,
        padding: 0,
        width: 18,
        height: 18,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
    } as CSSProperties,

    safariGoogleHero: { // <--- changed
        width: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
    } as CSSProperties,

    safariGoogleLogo: { // <--- changed
        fontSize: 48,
        fontWeight: 800,
        letterSpacing: -3,
        fontFamily: "Arial, sans-serif",
        lineHeight: 1,
    } as CSSProperties,

    safariGoogleSearchBar: { // <--- changed
        width: "calc(100% - 30px)",
        height: 44,
        borderRadius: 999,
        background: "rgba(255,255,255,0.96)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 15px",
    } as CSSProperties,

    safariGoogleSearchIcon: { // <--- changed
        color: "rgba(60,60,67,0.58)",
        fontSize: 16,
        fontWeight: 800,
    } as CSSProperties,

    safariGoogleSearchInput: { // <--- changed
        flex: 1,
        border: "none",
        outline: "none",
        background: "transparent",
        color: "#111",
        fontSize: 13,
        fontWeight: 600,
        minWidth: 0,
    } as CSSProperties,

    safariMaintenanceCard: { // <--- changed
        width: "calc(100% - 38px)",
        margin: "38px auto 0",
        borderRadius: 24,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 18px 38px rgba(0,0,0,0.12)",
        padding: "24px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 9,
    } as CSSProperties,

    safariMaintenanceIcon: { // <--- changed
        width: 38,
        height: 38,
        borderRadius: 999,
        background: "linear-gradient(145deg, #ff453a, #ff9f0a)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: 24,
        fontWeight: 950,
        boxShadow: "0 10px 20px rgba(255,69,58,0.28)",
    } as CSSProperties,

    safariMaintenanceTitle: { // <--- changed
        color: "#111",
        fontSize: 16,
        fontWeight: 900,
        lineHeight: 1.12,
        textAlign: "center",
    } as CSSProperties,

    safariMaintenanceText: { // <--- changed
        color: "rgba(60,60,67,0.72)",
        fontSize: 12,
        fontWeight: 650,
        lineHeight: 1.35,
        textAlign: "center",
        maxWidth: 220,
    } as CSSProperties,

    safariFakePageWrap: { // <--- changed
        width: "100%",
        height: "100%",
        padding: "34px 16px 96px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
    } as CSSProperties,

    safariFakePageTopLine: { // <--- changed
        color: "rgba(60,60,67,0.62)",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        textAlign: "center",
    } as CSSProperties,

    safariMaintenanceCardLarge: { // <--- changed
        width: "100%",
        minHeight: 292,
        borderRadius: 30,
        background: "rgba(255,255,255,0.94)",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 24px 50px rgba(0,0,0,0.16)",
        padding: "28px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
    } as CSSProperties,

    safariMaintenanceIconLarge: { // <--- changed
        width: 56,
        height: 56,
        borderRadius: 18,
        background: "linear-gradient(145deg, #ff453a, #ff9f0a)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: 34,
        fontWeight: 950,
        boxShadow: "0 16px 28px rgba(255,69,58,0.3)",
    } as CSSProperties,

    safariMaintenanceTitleLarge: { // <--- changed
        color: "#111",
        fontSize: 22,
        fontWeight: 950,
        lineHeight: 1.05,
        textAlign: "center",
        maxWidth: 250,
        overflowWrap: "anywhere",
    } as CSSProperties,

    safariMaintenanceTextLarge: { // <--- changed
        color: "rgba(60,60,67,0.74)",
        fontSize: 13,
        fontWeight: 650,
        lineHeight: 1.38,
        textAlign: "center",
        maxWidth: 250,
    } as CSSProperties,

    safariMaintenanceSubBox: { // <--- changed
        marginTop: 4,
        borderRadius: 14,
        background: "rgba(118,118,128,0.12)",
        color: "rgba(60,60,67,0.78)",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.35,
        padding: "9px 12px",
        textAlign: "center",
        maxWidth: 250,
        overflowWrap: "anywhere",
    } as CSSProperties,

    safariMaintenanceHomeButton: { // <--- changed
        marginTop: 8,
        border: "none",
        borderRadius: 999,
        background: "#007aff",
        color: "#fff",
        fontSize: 13,
        fontWeight: 850,
        padding: "10px 18px",
        boxShadow: "0 12px 22px rgba(0,122,255,0.26)",
        cursor: "pointer",
    } as CSSProperties,

    phoneHomeBarButton: { // <--- changed: restored actual clickable home indicator layout
        position: "absolute",
        left: "50%",
        bottom: -2, // <--- changed: moved further down on the Y closer to original placement // <--- changed: moved back down closer to original phone position
        width: 118,
        height: 24,
        transform: "translateX(-50%)",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 10000,
        WebkitTapHighlightColor: "transparent",
        touchAction: "none",
    } as CSSProperties,

    phoneHomeBar: { // <--- changed: restored visible iPhone home bar
        width: 104,
        height: 4,
        borderRadius: 999,
        background: "#ffffff",
        opacity: 0.96,
        display: "block",
        pointerEvents: "none",
        transition: "background 160ms ease, opacity 160ms ease, transform 160ms ease",
    } as CSSProperties,

    phoneHomeBarPressing: { // <--- changed
        transform: "translateY(-2px) scaleX(0.96)",
        opacity: 0.82,
    } as CSSProperties,

    phoneHomeBarHidden: { // <--- changed
        opacity: 0,
        transform: "translateY(8px)",
    } as CSSProperties,

    phoneHomeBarButtonLocked: { // <--- changed
        pointerEvents: "none",
    } as CSSProperties,


    phoneChromeFadeHidden: { // <--- changed
        opacity: 0,
        transition: "opacity 210ms cubic-bezier(0.22, 1, 0.36, 1)",
    } as CSSProperties,


    tradePanel: { // <--- restored: original full-size Buy/Sell/Pending row
        background: "#1b1b1b",
        padding: "24px 22px 30px",
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gridTemplateRows: "52px 52px",
        columnGap: 8,
        rowGap: 14,
        borderRadius: "24px 24px 0 0",
        alignItems: "stretch",
        justifyItems: "stretch",
        width: "100%",
        boxSizing: "border-box",
    } as CSSProperties,

    input: { // <--- restored
        gridColumn: "1",
        gridRow: "1",
        background: "#050505",
        color: "white",
        border: "1px solid #222",
        borderRadius: 18,
        textAlign: "center",
        fontSize: 28,
        fontWeight: 900,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 0,
        maxWidth: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
    } as CSSProperties,

    buy: { // <--- restored
        gridColumn: "2",
        gridRow: "1",
        background: GREEN,
        color: "white",
        border: "none",
        borderRadius: 18,
        fontSize: 26,
        fontWeight: 900,
        cursor: "pointer",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        minWidth: 0,
        maxWidth: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
    } as CSSProperties,

    sell: { // <--- restored
        gridColumn: "3",
        gridRow: "1",
        background: "#ff2f3a",
        color: "white",
        border: "none",
        borderRadius: 18,
        fontSize: 26,
        fontWeight: 900,
        cursor: "pointer",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        minWidth: 0,
        maxWidth: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
    } as CSSProperties,

    closePosition: { // <--- restored
        gridColumn: "2 / 4",
        gridRow: "1",
        background: "#ff2f3a",
        color: "#ffffff",
        border: "none",
        borderRadius: 14,
        fontSize: 16,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        boxSizing: "border-box",
        padding: "0 6px",
    } as CSSProperties,

    closePartials: { // <--- restored
        gridColumn: "1",
        gridRow: "2",
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        boxSizing: "border-box",
        padding: "0 2px",
        whiteSpace: "nowrap",
    } as CSSProperties,

    breakeven: { // <--- restored
        gridColumn: "2",
        gridRow: "2",
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        boxSizing: "border-box",
        padding: "0 2px",
        whiteSpace: "nowrap",
    } as CSSProperties,

    trailingStop: { // <--- restored
        gridColumn: "3",
        gridRow: "2",
        background: "#f1f1f1",
        color: "#111111",
        border: "none",
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        boxSizing: "border-box",
        padding: "0 2px",
        whiteSpace: "nowrap",
    } as CSSProperties,

    pendingOrder: { // <--- restored
        gridColumn: "1 / 4",
        gridRow: "2",
        background: PENDING_BUTTON_BLUE,
        color: "#ffffff",
        border: "none",
        borderRadius: 14,
        fontSize: 26,
        fontWeight: 900,
        cursor: "pointer",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
        height: "100%",
        justifySelf: "stretch",
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        boxSizing: "border-box",
        padding: "0 6px",
    } as CSSProperties,


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

    playIcon: {
        width: 0, // <--- changed
        height: 0, // <--- changed
        borderTop: "9px solid transparent", // <--- changed
        borderBottom: "9px solid transparent", // <--- changed
        borderLeft: "14px solid #ffffff", // <--- changed
        transform: "translateX(2px)", // <--- changed
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

};
