import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter, ZAxis, BarChart, Bar, ReferenceLine
} from 'recharts';
import { Activity, AlertTriangle, Calendar, Clock, Download, FileText, Github, Heart, Info, Settings, TrendingUp, ToggleLeft, ToggleRight, Upload, Loader, Trash2, ArrowLeft, X } from 'lucide-react';

const API_BASE = '';

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState('chronological');
  const [showThresholds, setShowThresholds] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [timeRange, setTimeRange] = useState('all'); // 'all', '24h', '48h', '7d', '30d', '90d', 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchReadings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/readings`);
      const rows = await res.json();
      const parsed = rows.map(r => ({
        ...r,
        displayDate: r.date,
        displayTime: r.time,
        hour: new Date(r.timestamp).getHours(),
      }));
      setData(parsed);
    } catch (err) {
      console.error('Failed to fetch readings:', err);
    } finally {
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        setUploadResult(result);
        await fetchReadings();
      } else {
        setUploadResult({ error: result.error });
      }
    } catch (err) {
      setUploadResult({ error: 'Upload failed. Please try again.' });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const filteredData = useMemo(() => {
    if (data.length === 0) return [];
    const now = Date.now();
    let fromTs = 0;
    let toTs = Infinity;

    if (timeRange === '24h') fromTs = now - 86400000;
    else if (timeRange === '48h') fromTs = now - 2 * 86400000;
    else if (timeRange === '7d') fromTs = now - 7 * 86400000;
    else if (timeRange === '30d') fromTs = now - 30 * 86400000;
    else if (timeRange === '90d') fromTs = now - 90 * 86400000;
    else if (timeRange === 'custom') {
      if (customFrom) fromTs = new Date(customFrom).setHours(0, 0, 0, 0);
      if (customTo) toTs = new Date(customTo).setHours(23, 59, 59, 999);
    }

    if (timeRange === 'all') return data;
    return data.filter(d => d.timestamp >= fromTs && d.timestamp <= toTs);
  }, [data, timeRange, customFrom, customTo]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const sysValues = filteredData.map(d => d.systolic).filter(v => !isNaN(v));
    const diaValues = filteredData.map(d => d.diastolic).filter(v => !isNaN(v));
    const pulseValues = filteredData.map(d => d.pulse).filter(v => !isNaN(v));

    return {
      count: filteredData.length,
      avgSys: Math.round(sysValues.reduce((a, b) => a + b, 0) / sysValues.length),
      maxSys: Math.max(...sysValues),
      minSys: Math.min(...sysValues),
      avgDia: Math.round(diaValues.reduce((a, b) => a + b, 0) / diaValues.length),
      maxDia: Math.max(...diaValues),
      minDia: Math.min(...diaValues),
      avgPulse: Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length),
    };
  }, [filteredData]);

  const diurnalData = useMemo(() => {
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`,
      sys: [],
      dia: []
    }));

    filteredData.forEach(d => {
      if (!isNaN(d.hour)) {
        hourly[d.hour].sys.push(d.systolic);
        hourly[d.hour].dia.push(d.diastolic);
      }
    });

    return hourly.map(h => ({
      ...h,
      avgSys: h.sys.length ? Math.round(h.sys.reduce((a, b) => a + b, 0) / h.sys.length) : null,
      avgDia: h.dia.length ? Math.round(h.dia.reduce((a, b) => a + b, 0) / h.dia.length) : null,
      count: h.sys.length
    })).filter(h => h.count > 0);
  }, [filteredData]);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#3f3f3f] border border-[#555] p-3 rounded-lg shadow-xl text-gray-100">
          <p className="text-sm font-bold mb-1">{item.displayDate} @ {item.displayTime}</p>
          <div className="space-y-1 text-xs">
            <p className="flex justify-between gap-4">
              <span className="text-[#2dd4bf]">Systolic:</span>
              <span className="font-mono">{item.systolic} mmHg</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-[#60a5fa]">Diastolic:</span>
              <span className="font-mono">{item.diastolic} mmHg</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-[#fb923c]">Pulse:</span>
              <span className="font-mono">{item.pulse} bpm</span>
            </p>
            {item.notes && item.notes !== '-' && (
              <p className="mt-2 text-gray-400 italic border-t border-[#555] pt-1">
                Note: {item.notes}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const DiurnalTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-[#3f3f3f] border border-[#555] p-3 rounded-lg shadow-xl text-gray-100">
          <p className="text-sm font-bold mb-1">{item.label} ({item.count} readings)</p>
          <div className="space-y-1 text-xs">
            <p className="flex justify-between gap-4">
              <span className="text-[#2dd4bf]">Avg Systolic:</span>
              <span className="font-mono">{item.avgSys} mmHg</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-[#60a5fa]">Avg Diastolic:</span>
              <span className="font-mono">{item.avgDia} mmHg</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (initialLoad) {
    return (
      <div className="min-h-screen bg-[#262626] flex items-center justify-center">
        <Loader className="animate-spin text-[#2dd4bf]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262626] text-gray-100 font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-gray-200">
            BP <span className="font-bold text-[#2dd4bf]">Analytics</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest font-medium">BP Data Visualization Dashboard</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <a
            href="https://github.com/chvvkumar/Omron-visualizer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Github size={14} />
            <span>GitHub</span>
          </a>
          <div className="flex items-center gap-3">
            <label className={`cursor-pointer bg-[#333] hover:bg-[#444] border border-[#555] px-4 py-2 rounded-md transition-all flex items-center gap-2 text-sm ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {loading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>{loading ? 'Processing...' : 'Load OMRON CSV'}</span>
              <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={loading} />
            </label>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-md border transition-all ${showSettings ? 'bg-[#444] border-[#555] text-gray-200' : 'bg-[#333] border-[#555] text-gray-400 hover:text-gray-200 hover:bg-[#444]'}`}
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Upload Result Banner */}
      {uploadResult && (
        <div className={`max-w-7xl mx-auto mb-6 p-3 rounded-lg border text-sm ${
          uploadResult.error
            ? 'bg-red-900/30 border-red-700 text-red-300'
            : 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
        }`}>
          {uploadResult.error || uploadResult.message}
          <button
            onClick={() => setUploadResult(null)}
            className="ml-4 text-xs opacity-60 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {showSettings ? (
        <SettingsPanel
          data={data}
          onBack={() => setShowSettings(false)}
          onDataChanged={fetchReadings}
        />
      ) : data.length === 0 ? (
        <label className={`max-w-2xl mx-auto mt-20 text-center p-12 border-2 border-dashed border-[#444] rounded-2xl bg-[#2a2a2a] block cursor-pointer hover:bg-[#333] hover:border-[#555] transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          <FileText className="mx-auto text-[#444] mb-4" size={48} />
          <h2 className="text-xl font-medium text-gray-300">No Data Loaded</h2>
          <p className="text-gray-500 mt-2">Click to upload your OMRON CSV file to generate visual trends.</p>
          <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={loading} />
        </label>
      ) : (
        <main className="max-w-7xl mx-auto space-y-6">

          {/* Factual Stats Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Average BP" value={`${stats.avgSys}/${stats.avgDia}`} subValue="mmHg" icon={<Activity size={20} />} color="#2dd4bf" />
            <StatCard label="Peak Systolic" value={stats.maxSys} subValue="mmHg" icon={<TrendingUp size={20} />} color="#60a5fa" />
            <StatCard label="Avg Pulse" value={stats.avgPulse} subValue="bpm" icon={<Heart size={20} />} color="#fb923c" />
            <StatCard label="Reading Count" value={stats.count} subValue="entries" icon={<Calendar size={20} />} color="#a78bfa" />
          </div>

          {/* Navigation & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-2 p-1 bg-[#1a1a1a] rounded-lg w-fit">
              <NavBtn active={viewMode === 'chronological'} onClick={() => setViewMode('chronological')}>Timeline</NavBtn>
              <NavBtn active={viewMode === 'distribution'} onClick={() => setViewMode('distribution')}>Spread</NavBtn>
              <NavBtn active={viewMode === 'diurnal'} onClick={() => setViewMode('diurnal')}>Time of Day</NavBtn>
            </div>

            <button
              onClick={() => setShowThresholds(!showThresholds)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border flex items-center gap-2 ${
                showThresholds
                  ? 'bg-[#333] text-gray-200 border-[#555] shadow-inner'
                  : 'bg-transparent text-gray-500 border-[#333] hover:text-gray-300'
              }`}
              title="Toggle standard 120/80 reference markers"
            >
              {showThresholds ? <ToggleRight size={16} className="text-[#2dd4bf]" /> : <ToggleLeft size={16} />}
              Ref Markers (120/80)
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#2a2a2a] p-3 rounded-lg">
            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold shrink-0">Time Range</span>
            <div className="flex flex-wrap items-center gap-2">
              {['all', '24h', '48h', '7d', '30d', '90d', 'custom'].map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${
                    timeRange === r
                      ? 'bg-[#333] text-[#2dd4bf] border border-[#555]'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {r === 'all' ? 'All' : r === 'custom' ? 'Custom' : `Last ${r}`}
                </button>
              ))}
              {timeRange === 'custom' && (
                <div className="flex items-center gap-2 ml-1">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="bg-[#333] border border-[#555] rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-[#2dd4bf]"
                  />
                  <span className="text-gray-600 text-xs">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="bg-[#333] border border-[#555] rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-[#2dd4bf]"
                  />
                  {(customFrom || customTo) && (
                    <button
                      onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                      className="text-gray-500 hover:text-gray-300"
                      title="Clear dates"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {timeRange !== 'all' && (
              <span className="text-[10px] text-gray-500 ml-auto">
                {filteredData.length} of {data.length} readings
              </span>
            )}
          </div>

          {/* Main Chart Area */}
          <div className="grid grid-cols-1 gap-6">

            {viewMode === 'chronological' && (
              <>
                <div className="bg-[#333] p-6 rounded-xl border border-[#444]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <TrendingUp size={18} className="text-[#2dd4bf]" />
                      Pressure Trends
                    </h3>
                  </div>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                        <XAxis
                          dataKey="displayDate"
                          stroke="#888"
                          fontSize={12}
                          tickMargin={10}
                          minTickGap={30}
                        />
                        <YAxis stroke="#888" fontSize={12} domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        {showThresholds && <ReferenceLine y={120} stroke="#2dd4bf" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'insideTopLeft', value: '120 Sys', fill: '#2dd4bf', fontSize: 10, opacity: 0.8 }} />}
                        {showThresholds && <ReferenceLine y={80} stroke="#60a5fa" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'insideBottomLeft', value: '80 Dia', fill: '#60a5fa', fontSize: 10, opacity: 0.8 }} />}
                        <Line
                          type="monotone"
                          name="Systolic"
                          dataKey="systolic"
                          stroke="#2dd4bf"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#2dd4bf' }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          type="monotone"
                          name="Diastolic"
                          dataKey="diastolic"
                          stroke="#60a5fa"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#60a5fa' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#333] p-6 rounded-xl border border-[#444]">
                  <h3 className="text-lg font-medium mb-6 flex items-center gap-2">
                    <Heart size={18} className="text-[#fb923c]" />
                    Pulse Rhythm
                  </h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                        <XAxis dataKey="displayDate" hide />
                        <YAxis stroke="#888" fontSize={12} domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip content={<CustomTooltip />} />
                        <defs>
                          <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="pulse"
                          stroke="#fb923c"
                          fillOpacity={1}
                          fill="url(#colorPulse)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {viewMode === 'distribution' && (
              <div className="bg-[#333] p-6 rounded-xl border border-[#444]">
                <h3 className="text-lg font-medium mb-2">Reading Correlation</h3>
                <p className="text-sm text-gray-500 mb-6 font-light">Distribution of individual readings across the Systolic/Diastolic axes.</p>
                <div className="h-[500px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid stroke="#444" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="systolic"
                        name="Systolic"
                        unit=" mmHg"
                        stroke="#888"
                        domain={[90, 180]}
                        label={{ value: 'Systolic', position: 'bottom', fill: '#888', offset: 0 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="diastolic"
                        name="Diastolic"
                        unit=" mmHg"
                        stroke="#888"
                        domain={[60, 120]}
                        label={{ value: 'Diastolic', angle: -90, position: 'insideLeft', fill: '#888' }}
                      />
                      <ZAxis type="number" dataKey="pulse" range={[50, 400]} name="Pulse" unit=" bpm" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                      {showThresholds && <ReferenceLine x={120} stroke="#2dd4bf" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'top', value: '120 Sys', fill: '#2dd4bf', fontSize: 10 }} />}
                      {showThresholds && <ReferenceLine y={80} stroke="#60a5fa" strokeDasharray="3 3" strokeOpacity={0.6} label={{ position: 'right', value: '80 Dia', fill: '#60a5fa', fontSize: 10 }} />}
                      <Scatter name="Readings" data={filteredData} fill="#2dd4bf" fillOpacity={0.6} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {viewMode === 'diurnal' && (
              <div className="bg-[#333] p-6 rounded-xl border border-[#444]">
                <h3 className="text-lg font-medium mb-2">Time-of-Day Fluctuations</h3>
                <p className="text-sm text-gray-500 mb-6 font-light">Aggregated averages grouped by the hour the reading was captured.</p>
                <div className="h-[450px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diurnalData} barGap={0}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                      <XAxis dataKey="label" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip content={<DiurnalTooltip />} />
                      <Legend />
                      {showThresholds && <ReferenceLine y={120} stroke="#2dd4bf" strokeDasharray="3 3" strokeOpacity={0.6} />}
                      {showThresholds && <ReferenceLine y={80} stroke="#60a5fa" strokeDasharray="3 3" strokeOpacity={0.6} />}
                      <Bar name="Avg Systolic" dataKey="avgSys" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                      <Bar name="Avg Diastolic" dataKey="avgDia" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>

          {/* Raw Data Log */}
          <div className="bg-[#333] rounded-xl border border-[#444] overflow-hidden">
            <div className="p-4 border-b border-[#444] flex justify-between items-center">
              <h3 className="font-medium flex items-center gap-2 text-sm text-gray-400">
                <FileText size={16} /> Data Log
              </h3>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Raw Values</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs text-gray-400">
                <thead className="bg-[#2a2a2a] sticky top-0">
                  <tr>
                    <th className="p-3">Date/Time</th>
                    <th className="p-3">Systolic</th>
                    <th className="p-3">Diastolic</th>
                    <th className="p-3">Pulse</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#444]">
                  {filteredData.slice().reverse().map((d, i) => (
                    <tr key={i} className="hover:bg-[#3a3a3a]">
                      <td className="p-3 font-mono text-gray-300">{d.displayDate} {d.displayTime}</td>
                      <td className="p-3 font-bold text-[#2dd4bf]">{d.systolic}</td>
                      <td className="p-3 font-bold text-[#60a5fa]">{d.diastolic}</td>
                      <td className="p-3 text-[#fb923c]">{d.pulse}</td>
                      <td className="p-3 truncate max-w-[150px]">{d.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 pt-6 border-t border-[#444] flex items-start gap-4 text-gray-500 italic text-xs">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>
          This dashboard presents raw historical data extracted from your OMRON report. No analysis, medical interpretation, or health advice is provided. These visualizations are intended for information organization purposes only.
        </p>
      </footer>
    </div>
  );
};

const SettingsPanel = ({ data, onBack, onDataChanged }) => {
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmRange, setConfirmRange] = useState(false);
  const [result, setResult] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const dateRange = useMemo(() => {
    if (data.length === 0) return null;
    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    return {
      earliest: sorted[0].displayDate,
      latest: sorted[sorted.length - 1].displayDate,
      earliestTs: sorted[0].timestamp,
      latestTs: sorted[sorted.length - 1].timestamp,
    };
  }, [data]);

  const rangeCount = useMemo(() => {
    if (!rangeFrom || !rangeTo) return null;
    const fromTs = new Date(rangeFrom).setHours(0, 0, 0, 0);
    const toTs = new Date(rangeTo).setHours(23, 59, 59, 999);
    return data.filter(d => d.timestamp >= fromTs && d.timestamp <= toTs).length;
  }, [data, rangeFrom, rangeTo]);

  const handleDeleteAll = async () => {
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/readings`, { method: 'DELETE' });
      const json = await res.json();
      setResult({ success: true, message: json.message });
      setConfirmAll(false);
      await onDataChanged();
    } catch {
      setResult({ success: false, message: 'Failed to delete data.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRange = async () => {
    if (!rangeFrom || !rangeTo) return;
    setDeleting(true);
    setResult(null);
    const fromTs = new Date(rangeFrom).setHours(0, 0, 0, 0);
    const toTs = new Date(rangeTo).setHours(23, 59, 59, 999);
    try {
      const res = await fetch(`${API_BASE}/api/readings/range?from=${fromTs}&to=${toTs}`, { method: 'DELETE' });
      const json = await res.json();
      setResult({ success: true, message: json.message });
      setConfirmRange(false);
      setRangeFrom('');
      setRangeTo('');
      await onDataChanged();
    } catch {
      setResult({ success: false, message: 'Failed to delete data.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-2"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h2 className="text-xl font-medium text-gray-200 flex items-center gap-2">
        <Settings size={20} className="text-gray-400" /> Settings
      </h2>

      {result && (
        <div className={`p-3 rounded-lg border text-sm ${
          result.success
            ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
            : 'bg-red-900/30 border-red-700 text-red-300'
        }`}>
          {result.message}
        </div>
      )}

      {/* Data Summary */}
      <div className="bg-[#333] p-5 rounded-xl border border-[#444]">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Data Summary</h3>
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No data stored.</p>
        ) : (
          <div className="text-sm text-gray-400 space-y-1">
            <p>Total readings: <span className="text-gray-200 font-mono">{data.length}</span></p>
            <p>Date range: <span className="text-gray-200 font-mono">{dateRange?.earliest}</span> to <span className="text-gray-200 font-mono">{dateRange?.latest}</span></p>
          </div>
        )}
      </div>

      {/* Delete by Date Range */}
      <div className="bg-[#333] p-5 rounded-xl border border-[#444]">
        <h3 className="text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
          <Trash2 size={14} className="text-amber-400" />
          Delete by Date Range
        </h3>
        <p className="text-xs text-gray-500 mb-4">Remove readings within a specific date range.</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">From</label>
            <input
              type="date"
              value={rangeFrom}
              onChange={e => { setRangeFrom(e.target.value); setConfirmRange(false); }}
              className="w-full bg-[#2a2a2a] border border-[#555] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#2dd4bf]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">To</label>
            <input
              type="date"
              value={rangeTo}
              onChange={e => { setRangeTo(e.target.value); setConfirmRange(false); }}
              className="w-full bg-[#2a2a2a] border border-[#555] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#2dd4bf]"
            />
          </div>
        </div>

        {rangeFrom && rangeTo && rangeCount !== null && (
          <p className="text-xs text-gray-400 mb-3">
            {rangeCount} reading{rangeCount !== 1 ? 's' : ''} found in this range.
          </p>
        )}

        {!confirmRange ? (
          <button
            onClick={() => setConfirmRange(true)}
            disabled={!rangeFrom || !rangeTo || rangeCount === 0 || deleting}
            className="px-4 py-2 text-sm rounded-md border border-amber-600 text-amber-400 hover:bg-amber-900/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 size={14} /> Delete Range
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteRange}
              disabled={deleting}
              className="px-4 py-2 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-500 transition-all flex items-center gap-2"
            >
              <AlertTriangle size={14} />
              {deleting ? 'Deleting...' : `Confirm: Delete ${rangeCount} reading${rangeCount !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setConfirmRange(false)}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Delete All Data */}
      <div className="bg-[#333] p-5 rounded-xl border border-red-900/50">
        <h3 className="text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
          <Trash2 size={14} className="text-red-400" />
          Delete All Data
        </h3>
        <p className="text-xs text-gray-500 mb-4">Permanently remove all stored readings. This cannot be undone.</p>

        {!confirmAll ? (
          <button
            onClick={() => setConfirmAll(true)}
            disabled={data.length === 0 || deleting}
            className="px-4 py-2 text-sm rounded-md border border-red-600 text-red-400 hover:bg-red-900/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 size={14} /> Delete All Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteAll}
              disabled={deleting}
              className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500 transition-all flex items-center gap-2"
            >
              <AlertTriangle size={14} />
              {deleting ? 'Deleting...' : `Confirm: Delete all ${data.length} readings`}
            </button>
            <button
              onClick={() => setConfirmAll(false)}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, subValue, icon, color }) => (
  <div className="bg-[#333] p-5 rounded-xl border border-[#444] relative overflow-hidden group">
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-gray-100">{value}</span>
          <span className="text-[10px] text-gray-500 font-medium">{subValue}</span>
        </div>
      </div>
      <div style={{ color }} className="opacity-80">
        {icon}
      </div>
    </div>
    <div
      className="absolute bottom-0 left-0 h-1 transition-all duration-300 group-hover:w-full w-4"
      style={{ backgroundColor: color }}
    />
  </div>
);

const NavBtn = ({ children, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
      active
        ? 'bg-[#333] text-white shadow-lg border border-[#555]'
        : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    {children}
  </button>
);

export default App;
