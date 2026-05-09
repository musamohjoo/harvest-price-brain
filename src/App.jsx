import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  CloudSun,
  DatabaseZap,
  Gauge,
  Leaf,
  LineChart,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Truck
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useEffect, useMemo, useState } from "react";

const WEATHER_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const FALLBACK_WEATHER_RISK = 44;

// Preset days for quickly showing how the recommendation reacts to market shocks.
const scenarios = {
  normal: {
    label: "Normal Market",
    weatherRisk: 32,
    demandTrend: 58,
    competitorStock: 47,
    fuelCost: 42,
    festivalDemand: 35,
    inventoryLevel: 48,
    shelfLife: 6
  },
  heatwave: {
    label: "Simulate Heatwave",
    weatherRisk: 88,
    demandTrend: 68,
    competitorStock: 28,
    fuelCost: 54,
    festivalDemand: 42,
    inventoryLevel: 42,
    shelfLife: 3
  },
  festival: {
    label: "Festival Demand",
    weatherRisk: 38,
    demandTrend: 86,
    competitorStock: 36,
    fuelCost: 46,
    festivalDemand: 91,
    inventoryLevel: 39,
    shelfLife: 7
  },
  glut: {
    label: "Oversupply Risk",
    weatherRisk: 26,
    demandTrend: 41,
    competitorStock: 82,
    fuelCost: 38,
    festivalDemand: 22,
    inventoryLevel: 87,
    shelfLife: 2
  }
};

// Crop profiles keep the model transparent: cost floor, volatility, perishability,
// seasonal demand, and location all live in one place.
const crops = {
  tomato: {
    name: "Tomato",
    region: "Nashik, Maharashtra",
    coordinates: { lat: 19.9975, lon: 73.7898 },
    unit: "quintal",
    productionCost: 1250,
    minimumMargin: 0.18,
    marketBase: 1850,
    volatility: 105,
    perishability: 0.92,
    demandSeason: [42, 44, 48, 55, 62, 71, 76, 69, 58, 52, 47, 44],
    normalShelfLife: 5,
    typicalInventory: 54
  },
  onion: {
    name: "Onion",
    region: "Lasalgaon, Maharashtra",
    coordinates: { lat: 20.142, lon: 74.2395 },
    unit: "quintal",
    productionCost: 980,
    minimumMargin: 0.22,
    marketBase: 1620,
    volatility: 82,
    perishability: 0.42,
    demandSeason: [51, 49, 47, 53, 59, 64, 66, 61, 56, 52, 49, 50],
    normalShelfLife: 10,
    typicalInventory: 61
  },
  apple: {
    name: "Apple",
    region: "Shopian, Kashmir",
    coordinates: { lat: 33.717, lon: 74.834 },
    unit: "quintal",
    productionCost: 3100,
    minimumMargin: 0.28,
    marketBase: 4650,
    volatility: 165,
    perishability: 0.58,
    demandSeason: [48, 51, 55, 61, 63, 58, 52, 49, 74, 82, 69, 57],
    normalShelfLife: 8,
    typicalInventory: 45
  }
};

const festivalDemandByMonth = [42, 38, 47, 54, 49, 45, 58, 69, 76, 88, 82, 66];

// Open-Meteo weather codes are converted into a 0-100 risk index for crop pricing.
const weatherCodeRisk = {
  0: 8,
  1: 14,
  2: 22,
  3: 28,
  45: 24,
  48: 28,
  51: 36,
  53: 42,
  55: 48,
  61: 56,
  63: 64,
  65: 76,
  71: 54,
  73: 64,
  75: 74,
  80: 58,
  81: 66,
  82: 78,
  95: 86,
  96: 92,
  99: 96
};

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToNearestTen(value) {
  return Math.round(value / 10) * 10;
}

function calculatePricing(crop, signals) {
  // Start with a farmer-safe floor, then move the price with demand, supply,
  // perishability, weather, and logistics pressure.
  const floorPrice = crop.productionCost * (1 + crop.minimumMargin);
  const demandLift = (signals.demandTrend - 50) * 7.2 + signals.festivalDemand * 3.1;
  const supplyPressure = (signals.inventoryLevel - 50) * 8.4 + (50 - signals.competitorStock) * 6.7;
  const shelfLifeDiscount = Math.max(0, 6 - signals.shelfLife) * crop.perishability * 95;
  const weatherPremium = signals.weatherRisk > 62 ? (signals.weatherRisk - 62) * 8.8 : 0;
  const logisticsPremium = Math.max(0, signals.fuelCost - 45) * 5.4;

  const rawPrice =
    crop.marketBase +
    demandLift -
    supplyPressure -
    shelfLifeDiscount +
    weatherPremium +
    logisticsPremium;

  const suggestedPrice = roundToNearestTen(Math.max(floorPrice, rawPrice));
  const expectedInFourDays = Math.round(
    suggestedPrice +
      (signals.weatherRisk - 45) * 5.2 +
      (signals.demandTrend - 48) * 4.4 -
      Math.max(0, signals.inventoryLevel - 58) * 6.2
  );

  const wasteReducedKg = Math.round(
    (signals.inventoryLevel * crop.perishability * Math.max(1, 7 - signals.shelfLife) * 11.5)
  );

  const confidence = clamp(
    Math.round(
      94 -
        Math.abs(signals.weatherRisk - 50) * 0.12 -
        Math.abs(signals.demandTrend - 50) * 0.08 -
        crop.perishability * 5 -
        (signals.shelfLife <= 2 ? 4 : 0)
    ),
    68,
    96
  );

  const waitProbability = clamp(
    Math.round(46 + signals.weatherRisk * 0.21 + signals.demandTrend * 0.19 - signals.inventoryLevel * 0.14),
    24,
    86
  );

  return {
    floorPrice,
    suggestedPrice,
    expectedInFourDays,
    confidence,
    waitProbability,
    wasteReducedKg,
    direction: expectedInFourDays > suggestedPrice ? "up" : "down",
    margin: ((suggestedPrice - crop.productionCost) / suggestedPrice) * 100
  };
}

function buildForecast(crop, signals, price) {
  return Array.from({ length: 9 }, (_, day) => {
    const demandWave = Math.sin(day / 1.7) * crop.volatility;
    const weatherDrift = (signals.weatherRisk - 45) * day * 3.2;
    const inventoryDrag = Math.max(0, signals.inventoryLevel - 55) * day * 4.4;
    const festivalLift = signals.festivalDemand > 65 ? day * 24 : 0;

    return {
      day: day === 0 ? "Today" : `D+${day}`,
      price: Math.round(price + demandWave + weatherDrift + festivalLift - inventoryDrag),
      floor: Math.round(crop.productionCost * (1 + crop.minimumMargin))
    };
  });
}

function buildSignalData(signals) {
  return [
    { name: "Demand", value: signals.demandTrend },
    { name: "Weather", value: signals.weatherRisk },
    { name: "Festival", value: signals.festivalDemand },
    { name: "Fuel", value: signals.fuelCost },
    { name: "Stock", value: signals.competitorStock }
  ];
}

function getLocalMarketGuess(crop) {
  const month = new Date().getMonth();
  const seasonalDemand = crop.demandSeason[month];
  const festivalDemand = festivalDemandByMonth[month];
  const fuelCost = clamp(43 + (month >= 4 && month <= 7 ? 8 : 0) + Math.round(crop.perishability * 6), 30, 86);

  return {
    demandTrend: clamp(Math.round(seasonalDemand * 0.7 + festivalDemand * 0.3), 24, 92),
    festivalDemand,
    fuelCost,
    competitorStock: clamp(Math.round(100 - seasonalDemand * 0.55 + crop.typicalInventory * 0.4), 18, 86),
    inventoryLevel: crop.typicalInventory,
    shelfLife: crop.normalShelfLife
  };
}

function scoreWeatherRisk(daily, crop) {
  const rainTotal = daily.precipitation_sum?.reduce((sum, value) => sum + value, 0) ?? 0;
  const maxTemp = Math.max(...(daily.temperature_2m_max ?? [30]));
  const minTemp = Math.min(...(daily.temperature_2m_min ?? [18]));
  const riskyWeatherCode = Math.max(...(daily.weather_code ?? [1]).map((code) => weatherCodeRisk[code] ?? 35));

  const heatStress = crop.name === "Apple" ? Math.max(0, maxTemp - 26) * 4.5 : Math.max(0, maxTemp - 35) * 5.2;
  const coldStress = crop.name === "Apple" ? Math.max(0, 2 - minTemp) * 7 : 0;
  const rainStress = Math.min(30, rainTotal * (crop.perishability > 0.8 ? 1.4 : 0.8));

  return clamp(Math.round(riskyWeatherCode * 0.45 + heatStress + coldStress + rainStress + 12), 8, 96);
}

function explainWeather(daily) {
  const maxTemp = Math.round(Math.max(...(daily.temperature_2m_max ?? [0])));
  const rainTotal = Math.round(daily.precipitation_sum?.reduce((sum, value) => sum + value, 0) ?? 0);
  return `${maxTemp}°C peak, ${rainTotal}mm rain forecast`;
}

async function fetchWeatherSignals(crop) {
  const { lat, lon } = crop.coordinates;
  const url = new URL(WEATHER_FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    forecast_days: "7",
    timezone: "auto"
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Weather service did not return a forecast");
  }

  const data = await response.json();
  return {
    weatherRisk: scoreWeatherRisk(data.daily, crop),
    weatherNote: explainWeather(data.daily)
  };
}

function SignalSlider({ icon: Icon, label, value, min = 0, max = 100, suffix = "", onChange }) {
  return (
    <label className="control">
      <span className="control__header">
        <span>
          <Icon size={17} />
          {label}
        </span>
        <strong>
          {value}
          {suffix}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function MetricCard({ icon: Icon, label, value, tone, detail }) {
  return (
    <section className={`metric metric--${tone}`}>
      <div className="metric__icon">
        <Icon size={20} />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </section>
  );
}

function App() {
  const [cropKey, setCropKey] = useState("tomato");
  const [signals, setSignals] = useState(scenarios.normal);
  // Auto mode refreshes market data on crop changes. Manual mode keeps the user's what-if scenario intact.
  const [dataMode, setDataMode] = useState("auto");
  const [dataStatus, setDataStatus] = useState("Preparing auto market scan");
  const crop = crops[cropKey];

  const pricing = useMemo(() => calculatePricing(crop, signals), [crop, signals]);
  const forecast = useMemo(
    () => buildForecast(crop, signals, pricing.suggestedPrice),
    [crop, signals, pricing.suggestedPrice]
  );
  const signalData = useMemo(() => buildSignalData(signals), [signals]);

  async function refreshAutoSignals(selectedCrop = crop) {
    const marketGuess = getLocalMarketGuess(selectedCrop);
    setDataMode("auto");
    setDataStatus(`Scanning live weather for ${selectedCrop.region}`);

    try {
      const weather = await fetchWeatherSignals(selectedCrop);
      // Bad weather usually tightens available supply and shortens shelf life for delicate crops.
      const weatherInventoryImpact = weather.weatherRisk > 70 ? -8 : weather.weatherRisk < 25 ? 5 : 0;
      const shelfLifeHit = weather.weatherRisk > 72 && selectedCrop.perishability > 0.7 ? 2 : 0;

      setSignals({
        label: "Auto Market Scan",
        ...marketGuess,
        weatherRisk: weather.weatherRisk,
        competitorStock: clamp(marketGuess.competitorStock + weatherInventoryImpact, 12, 92),
        shelfLife: clamp(marketGuess.shelfLife - shelfLifeHit, 1, 12),
        sourceNote: `Live weather via Open-Meteo. ${weather.weatherNote}. Other signals are seasonal crop estimates.`
      });
      setDataStatus("Auto signals updated from live weather and crop-season estimates");
    } catch (error) {
      setSignals({
        label: "Auto Market Scan",
        ...marketGuess,
        weatherRisk: FALLBACK_WEATHER_RISK,
        sourceNote:
          "Live weather was unavailable, so the engine used seasonal crop estimates. Manual controls still work."
      });
      setDataStatus("Weather fetch failed; using deploy-safe seasonal estimates");
    }
  }

  useEffect(() => {
    if (dataMode === "auto") {
      refreshAutoSignals(crop);
    }
  }, [cropKey]);

  function updateSignal(key, value) {
    setDataMode("manual");
    setDataStatus("Manual what-if override is active");
    setSignals((current) => ({ ...current, label: "Custom Simulation", [key]: value }));
  }

  function applyScenario(scenario) {
    setDataMode("manual");
    setDataStatus("Manual scenario is active");
    setSignals(scenario);
  }

  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="brand" href="#">
          <Leaf size={20} />
          Harvest Price Brain
        </a>
        <div>
          <a href="#problem">Problem</a>
          <a href="#engine">Engine</a>
          <a href="#pricing">Pricing</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero__copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            Future-proof pricing for crop bids
          </div>
          <h1>Harvest Price Brain</h1>
          <p>
            A predictive pricing website that helps farmers decide when to sell, what bid to accept,
            and how to avoid distress sales before weather, demand, or supply shocks hit the mandi.
          </p>
          <div className="hero__actions">
            <a href="#pricing" className="button button--primary">
              <LineChart size={18} />
              Check Price
            </a>
          </div>
        </div>
        <aside className="hero__panel" aria-label="Live recommended bid">
          <span>Recommended bid</span>
          <strong>{money(pricing.suggestedPrice)}</strong>
          <p>
            per {crop.unit} for {crop.name} in {crop.region}
          </p>
          <div className="confidence">
            <Gauge size={18} />
            {pricing.confidence}% confidence
          </div>
        </aside>
      </section>

      <section className="ticker" aria-label="Pricing engine data inputs">
        <span><CloudSun size={16} /> Weather forecast</span>
        <span><Activity size={16} /> Demand trends</span>
        <span><Truck size={16} /> Fuel costs</span>
        <span><Boxes size={16} /> Inventory pressure</span>
        <span><Timer size={16} /> Shelf life</span>
      </section>

      <section className="story-section" id="problem">
        <div className="section-heading">
          <p className="section-kicker">The problem</p>
          <h2>Farmers are still pricing reactively.</h2>
          <p>
            Crop prices move because of rain, storage pressure, transport cost, competitor stock, and sudden
            demand spikes. Most farmers only see that movement after the loss has already happened.
          </p>
        </div>
        <div className="website-cards">
          <article>
            <ArrowDownRight size={22} />
            <h3>Distress sales</h3>
            <p>Low shelf life and high inventory push farmers to accept weak bids just to clear stock.</p>
          </article>
          <article>
            <CloudSun size={22} />
            <h3>Climate volatility</h3>
            <p>Weather shocks change supply and quality before traditional price boards react.</p>
          </article>
          <article>
            <BarChart3 size={22} />
            <h3>No confidence layer</h3>
            <p>A price alone is not enough. Farmers need probability, timing, and risk explanation.</p>
          </article>
        </div>
      </section>

      <section className="engine-section" id="engine">
        <div className="section-heading">
          <p className="section-kicker">The solution</p>
          <h2>A pricing brain that thinks before the market moves.</h2>
          <p>
            The engine combines a protected cost floor with live and estimated market signals, then returns
            a bid recommendation, confidence score, future target, and waste-reduction estimate.
          </p>
        </div>
        <div className="flow-grid">
          <article>
            <DatabaseZap size={22} />
            <span>01</span>
            <h3>Read signals</h3>
            <p>Weather, crop seasonality, festival demand, logistics pressure, stock level, and shelf life.</p>
          </article>
          <article>
            <ShieldCheck size={22} />
            <span>02</span>
            <h3>Protect floor</h3>
            <p>Production cost plus minimum margin becomes the hard lower bound for any recommendation.</p>
          </article>
          <article>
            <TrendingUp size={22} />
            <span>03</span>
            <h3>Forecast bid</h3>
            <p>The price curve shows whether the farmer should sell now or hold inventory briefly.</p>
          </article>
        </div>
      </section>

      <section className="impact-band">
        <MetricCard
          icon={BadgeIndianRupee}
          label="Best bid now"
          value={money(pricing.suggestedPrice)}
          detail={`${pricing.margin.toFixed(1)}% protected margin`}
          tone="green"
        />
        <MetricCard
          icon={pricing.direction === "up" ? ArrowUpRight : ArrowDownRight}
          label="4-day outlook"
          value={money(pricing.expectedInFourDays)}
          detail={`${pricing.waitProbability}% probability of this move`}
          tone={pricing.direction === "up" ? "blue" : "amber"}
        />
        <MetricCard
          icon={Leaf}
          label="Waste avoided"
          value={`${pricing.wasteReducedKg.toLocaleString("en-IN")} kg`}
          detail="estimated from shelf-life pricing"
          tone="teal"
        />
      </section>

      <section className="pricing-intro" id="pricing">
        <div className="section-heading">
          <p className="section-kicker">Live pricing tool</p>
          <h2>See the recommendation change with market conditions.</h2>
          <p>
            The page auto-scans weather for the selected crop region and estimates the remaining market
            signals. The scenario buttons and sliders let farmers explore different market days.
          </p>
        </div>
      </section>

      <section className="pricing-tool">
        <aside className="sidebar">
          <div>
            <p className="section-kicker">Market controls</p>
            <h2>Market Inputs</h2>
          </div>

          <button className="auto-scan" onClick={() => refreshAutoSignals(crop)}>
            <RefreshCw size={17} />
            Auto Market Scan
          </button>

          <div className="data-note">
            <DatabaseZap size={18} />
            <span>{dataStatus}</span>
          </div>

          <div className="crop-tabs" aria-label="Choose crop">
            {Object.entries(crops).map(([key, item]) => (
              <button
                key={key}
                className={cropKey === key ? "is-active" : ""}
                onClick={() => setCropKey(key)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="scenario-grid">
            {Object.entries(scenarios).map(([key, scenario]) => (
              <button key={key} onClick={() => applyScenario(scenario)}>
                {scenario.label}
              </button>
            ))}
          </div>

          <SignalSlider
            icon={TrendingUp}
            label="Demand trend"
            value={signals.demandTrend}
            onChange={(value) => updateSignal("demandTrend", value)}
          />
          <SignalSlider
            icon={CloudSun}
            label="Weather risk"
            value={signals.weatherRisk}
            onChange={(value) => updateSignal("weatherRisk", value)}
          />
          <SignalSlider
            icon={Boxes}
            label="Competitor stock"
            value={signals.competitorStock}
            onChange={(value) => updateSignal("competitorStock", value)}
          />
          <SignalSlider
            icon={Truck}
            label="Fuel cost index"
            value={signals.fuelCost}
            onChange={(value) => updateSignal("fuelCost", value)}
          />
          <SignalSlider
            icon={PackageCheck}
            label="Inventory level"
            value={signals.inventoryLevel}
            onChange={(value) => updateSignal("inventoryLevel", value)}
          />
          <SignalSlider
            icon={Timer}
            label="Shelf life"
            value={signals.shelfLife}
            min={1}
            max={12}
            suffix="d"
            onChange={(value) => updateSignal("shelfLife", value)}
          />
        </aside>

        <section className="dashboard">
          <div className="dashboard__top">
            <div>
              <p className="section-kicker">{signals.label}</p>
              <h2>{crop.name} bid recommendation</h2>
            </div>
            <div className="status-pill">
              <ShieldCheck size={18} />
              Floor protected at {money(pricing.floorPrice)}
            </div>
          </div>

          <div className="recommendation-banner">
            <span>Suggested bid</span>
            <strong>{money(pricing.suggestedPrice)}</strong>
            <p>
              {pricing.confidence}% confidence. Waiting four days has a {pricing.waitProbability}% upside signal.
            </p>
          </div>

          <section className="chart-panel">
            <div className="panel-title">
              <div>
                <p className="section-kicker">Future-proof curve</p>
                <h3>Bid forecast vs. margin floor</h3>
              </div>
              <BarChart3 size={21} />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={forecast} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#20745f" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#20745f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dfe7e1" strokeDasharray="4 4" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip formatter={(value) => money(value)} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#20745f"
                  strokeWidth={3}
                  fill="url(#priceGradient)"
                  name="Suggested bid"
                />
                <Line
                  type="monotone"
                  dataKey="floor"
                  stroke="#d28428"
                  strokeWidth={2}
                  strokeDasharray="7 7"
                  name="Margin floor"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <section className="insight-grid">
            <div className="insight">
              <p className="section-kicker">Engine explanation</p>
              <h3>Why this price?</h3>
              <p>
                The engine starts with production cost plus minimum margin, then adjusts for live weather,
                seasonal demand, festival demand, competitor stock, logistics cost, inventory pressure,
                and remaining shelf life.
              </p>
              {signals.sourceNote && <p className="source-note">{signals.sourceNote}</p>}
              <div className="recommendation">
                <strong>Decision note</strong>
                <span>
                  Sell now at {money(pricing.suggestedPrice)} unless the farmer can safely hold stock for
                  four days. Waiting has a {pricing.waitProbability}% upside signal.
                </span>
              </div>
            </div>
            <div className="signal-card">
              <p className="section-kicker">Alternative data</p>
              <h3>Signal strength</h3>
              <ResponsiveContainer width="100%" height={190}>
                <ReLineChart data={signalData} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#e4ebe6" strokeDasharray="4 4" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#184f46" strokeWidth={3} dot={{ r: 5 }} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </section>
      </section>

      <footer className="site-footer">
        <Leaf size={18} />
        <span>Harvest Price Brain helps farmers price with context, not guesswork.</span>
      </footer>
    </main>
  );
}

export default App;
