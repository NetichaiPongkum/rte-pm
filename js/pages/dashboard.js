// ==========================================
// DASHBOARD PAGE - Engineering Analytics
// ==========================================

function DashboardPage({ user, showToast }) {
    const h = React.createElement;
    const [period, setPeriod] = React.useState('monthly');
    const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = React.useState(new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear().toString());
    const [pmRecords, setPmRecords] = React.useState([]);
    const [inspRecords, setInspRecords] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    // Recharts components
    const RC = window.Recharts || {};
    const {
        BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
        XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar
    } = RC;

    React.useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                const [pmRes, inspRes] = await Promise.all([
                    window.supabaseClient.from('pm_checklist_records').select('*').order('performed_date', { ascending: true }),
                    window.supabaseClient.from('inspection_records').select('*').order('performed_date', { ascending: true })
                ]);
                setPmRecords(pmRes.data || []);
                setInspRecords(inspRes.data || []);
            } else {
                setPmRecords(JSON.parse(localStorage.getItem('demo_pm_records') || '[]'));
                setInspRecords(JSON.parse(localStorage.getItem('demo_inspection_records') || '[]'));
            }
        } catch (e) { showToast('โหลดข้อมูลล้มเหลว', 'error'); }
        finally { setLoading(false); }
    };

    // ── Filter helpers ──────────────────────────────
    const filterRecords = (recs) => {
        if (period === 'daily') return recs.filter(r => (r.performed_date || '') === selectedDate);
        if (period === 'monthly') return recs.filter(r => (r.performed_date || '').startsWith(selectedMonth));
        if (period === 'yearly') return recs.filter(r => (r.performed_date || '').startsWith(selectedYear));
        return recs;
    };

    const pmFiltered   = filterRecords(pmRecords);
    const inspFiltered = filterRecords(inspRecords);

    // ── Pass/Fail stats from checklist_data ─────────
    const calcStats = (recs) => {
        let pass = 0, fail = 0, na = 0;
        recs.forEach(r => {
            (r.checklist_data || []).forEach(item => {
                if (item.result === 'pass') pass++;
                else if (item.result === 'fail') fail++;
                else na++;
            });
        });
        const total = pass + fail + na;
        const passRate = total > 0 ? ((pass / total) * 100).toFixed(1) : '0';
        return { pass, fail, na, total, passRate };
    };

    const pmStats   = calcStats(pmFiltered);
    const inspStats = calcStats(inspFiltered);

    // ── Trend chart data (by day or month) ──────────
    const buildTrend = (recs, groupFn) => {
        const map = {};
        recs.forEach(r => {
            const key = groupFn(r.performed_date || '');
            if (!key) return;
            if (!map[key]) map[key] = { label: key, count: 0, pass: 0, fail: 0 };
            map[key].count++;
            (r.checklist_data || []).forEach(item => {
                if (item.result === 'pass') map[key].pass++;
                else if (item.result === 'fail') map[key].fail++;
            });
        });
        return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
    };

    const trendGroupFn = period === 'yearly'
        ? d => d.slice(0, 7)   // group by month
        : d => d;               // group by day

    const pmTrend   = buildTrend(period === 'yearly' ? pmRecords.filter(r => (r.performed_date||'').startsWith(selectedYear))   : pmFiltered,   trendGroupFn);
    const inspTrend = buildTrend(period === 'yearly' ? inspRecords.filter(r => (r.performed_date||'').startsWith(selectedYear)) : inspFiltered, trendGroupFn);

    // Merge trend
    const allKeys = [...new Set([...pmTrend.map(d=>d.label), ...inspTrend.map(d=>d.label)])].sort();
    const trendData = allKeys.map(k => ({
        label: k.length === 10 ? k.slice(5) : k, // strip year for display
        pm:   (pmTrend.find(d => d.label === k)?.count  || 0),
        insp: (inspTrend.find(d => d.label === k)?.count || 0),
        pmPass:   pmTrend.find(d => d.label === k)?.pass  || 0,
        pmFail:   pmTrend.find(d => d.label === k)?.fail  || 0,
        inspPass: inspTrend.find(d => d.label === k)?.pass || 0,
        inspFail: inspTrend.find(d => d.label === k)?.fail || 0,
    }));

    // ── PM Level breakdown ───────────────────────────
    const levelMap = {};
    pmFiltered.forEach(r => {
        const lv = r.pm_level || 'Unknown';
        levelMap[lv] = (levelMap[lv] || 0) + 1;
    });
    const levelData = Object.entries(levelMap).map(([name, value]) => ({ name, value }));

    // ── Top molds ────────────────────────────────────
    const moldMap = {};
    [...pmFiltered, ...inspFiltered].forEach(r => {
        const k = r.mold_code || '-';
        if (!moldMap[k]) moldMap[k] = { mold: k, pm: 0, insp: 0 };
        if (r.performed_date) {
            if (pmFiltered.includes(r)) moldMap[k].pm++;
            else moldMap[k].insp++;
        }
    });
    pmFiltered.forEach(r => { const k = r.mold_code||'-'; if (!moldMap[k]) moldMap[k] = {mold:k, pm:0, insp:0}; moldMap[k].pm++; });
    inspFiltered.forEach(r => { const k = r.mold_code||'-'; if (!moldMap[k]) moldMap[k] = {mold:k, pm:0, insp:0}; moldMap[k].insp++; });
    const topMolds = Object.values(moldMap).sort((a,b) => (b.pm+b.insp)-(a.pm+a.insp)).slice(0, 6);

    // ── Pie data ─────────────────────────────────────
    const pmPieData   = [{ name:'Pass', value: pmStats.pass }, { name:'Fail', value: pmStats.fail }, { name:'N/A', value: pmStats.na }].filter(d=>d.value>0);
    const inspPieData = [{ name:'Pass', value: inspStats.pass }, { name:'Fail', value: inspStats.fail }, { name:'N/A', value: inspStats.na }].filter(d=>d.value>0);
    const COLORS = ['#10b981', '#ef4444', '#6b7280'];
    const LEVEL_COLORS = ['#6366f1','#f59e0b','#10b981','#ec4899'];

    // ── Period label ─────────────────────────────────
    const periodLabel = period === 'daily' ? selectedDate
        : period === 'monthly' ? selectedMonth
        : selectedYear;

    // ── KPI Card component ───────────────────────────
    const KPICard = ({ label, value, sub, icon, color, bg }) =>
        h('div', { className: `card flex items-center gap-4 hover:border-white/15 transition-all` },
            h('div', { className: `w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}` },
                h('i', { className: `fa-solid ${icon} text-lg ${color}` })
            ),
            h('div', { className: 'min-w-0' },
                h('p', { className: 'text-[11px] text-surface-500 uppercase tracking-wider font-semibold' }, label),
                h('p', { className: 'text-2xl font-bold text-white' }, value),
                sub && h('p', { className: 'text-[10px] text-surface-500 mt-0.5' }, sub)
            )
        );

    // ── Section Header ────────────────────────────────
    const SectionHeader = ({ title, icon, color }) =>
        h('div', { className: 'flex items-center gap-2 mb-3' },
            h('i', { className: `fa-solid ${icon} ${color}` }),
            h('h3', { className: 'text-sm font-bold text-surface-200' }, title)
        );

    // ── Tooltip styles ────────────────────────────────
    const tooltipStyle = { backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

    if (loading) return h('div', { className: 'flex items-center justify-center min-h-[60vh]' },
        h('div', { className: 'loading-spinner' })
    );

    return h('div', { className: 'space-y-6 animate-fade-in pb-8' },

        // ── Header ─────────────────────────────────────
        h('div', { className: 'flex flex-col md:flex-row md:items-center justify-between gap-4' },
            h('div', null,
                h('h2', { className: 'text-xl font-bold text-white' }, 'Engineering Dashboard'),
                h('p', { className: 'text-sm text-surface-400 mt-0.5' }, `PM & Inspection Analytics — ${periodLabel}`)
            ),
            h('div', { className: 'flex flex-wrap items-center gap-2' },
                // Period selector
                ['daily','monthly','yearly'].map(p =>
                    h('button', {
                        key: p,
                        className: `btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`,
                        onClick: () => setPeriod(p)
                    }, p === 'daily' ? 'รายวัน' : p === 'monthly' ? 'รายเดือน' : 'รายปี')
                ),
                // Date picker
                period === 'daily' && h('input', { type: 'date', className: 'input text-sm py-1.5 w-36 border border-white/10', value: selectedDate, onChange: e => setSelectedDate(e.target.value) }),
                period === 'monthly' && h('input', { type: 'month', className: 'input text-sm py-1.5 w-36 border border-white/10', value: selectedMonth, onChange: e => setSelectedMonth(e.target.value) }),
                period === 'yearly' && h('select', { className: 'input text-sm py-1.5 w-28 border border-white/10', value: selectedYear, onChange: e => setSelectedYear(e.target.value) },
                    ['2023','2024','2025','2026','2027'].map(y => h('option', { key: y, value: y }, y))
                ),
                h('button', { className: 'btn btn-ghost btn-sm', onClick: loadData },
                    h('i', { className: 'fa-solid fa-sync mr-1' }), 'Refresh'
                )
            )
        ),

        // ── KPI Row ─────────────────────────────────────
        h('div', { className: 'grid grid-cols-2 lg:grid-cols-4 gap-4' },
            h(KPICard, { label: 'PM ทั้งหมด', value: pmFiltered.length, sub: `รายการในช่วงที่เลือก`, icon: 'fa-clipboard-check', color: 'text-indigo-400', bg: 'bg-indigo-500/10' }),
            h(KPICard, { label: 'PM Pass Rate', value: `${pmStats.passRate}%`, sub: `Pass ${pmStats.pass} / Fail ${pmStats.fail}`, icon: 'fa-chart-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }),
            h(KPICard, { label: 'Inspection ทั้งหมด', value: inspFiltered.length, sub: `รายการในช่วงที่เลือก`, icon: 'fa-magnifying-glass-chart', color: 'text-cyan-400', bg: 'bg-cyan-500/10' }),
            h(KPICard, { label: 'Inspection Pass Rate', value: `${inspStats.passRate}%`, sub: `Pass ${inspStats.pass} / Fail ${inspStats.fail}`, icon: 'fa-circle-check', color: 'text-amber-400', bg: 'bg-amber-500/10' })
        ),

        // ── Trend Chart (full width) ─────────────────────
        h('div', { className: 'card' },
            h(SectionHeader, { title: 'แนวโน้มการตรวจสอบ (PM & Inspection)', icon: 'fa-chart-area', color: 'text-indigo-400' }),
            trendData.length === 0
                ? h('div', { className: 'flex items-center justify-center h-40 text-surface-500 text-sm' }, 'ไม่มีข้อมูลในช่วงนี้')
                : h(ResponsiveContainer, { width: '100%', height: 220 },
                    h(BarChart, { data: trendData, margin: { top: 5, right: 10, left: -10, bottom: 5 } },
                        h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)' }),
                        h(XAxis, { dataKey: 'label', tick: { fill: '#64748b', fontSize: 10 }, axisLine: false, tickLine: false }),
                        h(YAxis, { tick: { fill: '#64748b', fontSize: 10 }, axisLine: false, tickLine: false }),
                        h(Tooltip, { contentStyle: tooltipStyle }),
                        h(Legend, { wrapperStyle: { fontSize: '11px', color: '#94a3b8' } }),
                        h(Bar, { dataKey: 'pm', name: 'PM', fill: '#6366f1', radius: [3,3,0,0] }),
                        h(Bar, { dataKey: 'insp', name: 'Inspection', fill: '#06b6d4', radius: [3,3,0,0] })
                    )
                )
        ),

        // ── Row 2: Pass/Fail Line + PM Pie + Insp Pie ────
        h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-4' },

            // Pass/Fail trend line
            h('div', { className: 'card lg:col-span-1' },
                h(SectionHeader, { title: 'PM Pass vs Fail', icon: 'fa-chart-line', color: 'text-emerald-400' }),
                trendData.length === 0
                    ? h('div', { className: 'flex items-center justify-center h-36 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                    : h(ResponsiveContainer, { width: '100%', height: 180 },
                        h(LineChart, { data: trendData, margin: { top: 5, right: 10, left: -15, bottom: 5 } },
                            h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)' }),
                            h(XAxis, { dataKey: 'label', tick: { fill: '#64748b', fontSize: 9 }, axisLine: false, tickLine: false }),
                            h(YAxis, { tick: { fill: '#64748b', fontSize: 9 }, axisLine: false, tickLine: false }),
                            h(Tooltip, { contentStyle: tooltipStyle }),
                            h(Legend, { wrapperStyle: { fontSize: '10px' } }),
                            h(Line, { type: 'monotone', dataKey: 'pmPass', name: 'PM Pass', stroke: '#10b981', strokeWidth: 2, dot: false }),
                            h(Line, { type: 'monotone', dataKey: 'pmFail', name: 'PM Fail', stroke: '#ef4444', strokeWidth: 2, dot: false })
                        )
                    )
            ),

            // PM Pie
            h('div', { className: 'card' },
                h(SectionHeader, { title: 'PM ผลการตรวจ', icon: 'fa-circle-half-stroke', color: 'text-indigo-400' }),
                pmPieData.length === 0
                    ? h('div', { className: 'flex items-center justify-center h-36 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                    : h(ResponsiveContainer, { width: '100%', height: 180 },
                        h(PieChart, null,
                            h(Pie, { data: pmPieData, cx: '50%', cy: '50%', innerRadius: 45, outerRadius: 70, paddingAngle: 3, dataKey: 'value' },
                                pmPieData.map((_, i) => h(Cell, { key: i, fill: COLORS[i] }))
                            ),
                            h(Tooltip, { contentStyle: tooltipStyle }),
                            h(Legend, { wrapperStyle: { fontSize: '10px', color: '#94a3b8' } })
                        )
                    ),
                h('div', { className: 'flex justify-around mt-2' },
                    h('div', { className: 'text-center' }, h('p', { className: 'text-emerald-400 font-bold' }, pmStats.pass), h('p', { className: 'text-[10px] text-surface-500' }, 'Pass')),
                    h('div', { className: 'text-center' }, h('p', { className: 'text-red-400 font-bold' }, pmStats.fail), h('p', { className: 'text-[10px] text-surface-500' }, 'Fail')),
                    h('div', { className: 'text-center' }, h('p', { className: 'text-surface-400 font-bold' }, pmStats.na), h('p', { className: 'text-[10px] text-surface-500' }, 'N/A'))
                )
            ),

            // Insp Pie
            h('div', { className: 'card' },
                h(SectionHeader, { title: 'Inspection ผลการตรวจ', icon: 'fa-circle-half-stroke', color: 'text-cyan-400' }),
                inspPieData.length === 0
                    ? h('div', { className: 'flex items-center justify-center h-36 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                    : h(ResponsiveContainer, { width: '100%', height: 180 },
                        h(PieChart, null,
                            h(Pie, { data: inspPieData, cx: '50%', cy: '50%', innerRadius: 45, outerRadius: 70, paddingAngle: 3, dataKey: 'value' },
                                inspPieData.map((_, i) => h(Cell, { key: i, fill: COLORS[i] }))
                            ),
                            h(Tooltip, { contentStyle: tooltipStyle }),
                            h(Legend, { wrapperStyle: { fontSize: '10px', color: '#94a3b8' } })
                        )
                    ),
                h('div', { className: 'flex justify-around mt-2' },
                    h('div', { className: 'text-center' }, h('p', { className: 'text-emerald-400 font-bold' }, inspStats.pass), h('p', { className: 'text-[10px] text-surface-500' }, 'Pass')),
                    h('div', { className: 'text-center' }, h('p', { className: 'text-red-400 font-bold' }, inspStats.fail), h('p', { className: 'text-[10px] text-surface-500' }, 'Fail')),
                    h('div', { className: 'text-center' }, h('p', { className: 'text-surface-400 font-bold' }, inspStats.na), h('p', { className: 'text-[10px] text-surface-500' }, 'N/A'))
                )
            )
        ),

        // ── Row 3: PM Level bar + Top Molds table ────────
        h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' },

            // PM by Level
            h('div', { className: 'card' },
                h(SectionHeader, { title: 'PM ตามระดับ (Level)', icon: 'fa-layer-group', color: 'text-amber-400' }),
                levelData.length === 0
                    ? h('div', { className: 'flex items-center justify-center h-40 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                    : h(ResponsiveContainer, { width: '100%', height: 200 },
                        h(BarChart, { data: levelData, layout: 'vertical', margin: { top: 5, right: 20, left: 20, bottom: 5 } },
                            h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', horizontal: false }),
                            h(XAxis, { type: 'number', tick: { fill: '#64748b', fontSize: 10 }, axisLine: false, tickLine: false }),
                            h(YAxis, { type: 'category', dataKey: 'name', tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false, width: 80 }),
                            h(Tooltip, { contentStyle: tooltipStyle }),
                            h(Bar, { dataKey: 'value', name: 'จำนวน', radius: [0,4,4,0] },
                                levelData.map((_, i) => h(Cell, { key: i, fill: LEVEL_COLORS[i % LEVEL_COLORS.length] }))
                            )
                        )
                    )
            ),

            // Top Molds
            h('div', { className: 'card' },
                h(SectionHeader, { title: 'แม่พิมพ์ที่ถูกตรวจบ่อยที่สุด', icon: 'fa-trophy', color: 'text-amber-400' }),
                topMolds.length === 0
                    ? h('div', { className: 'flex items-center justify-center h-40 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                    : h('div', { className: 'space-y-2' },
                        topMolds.map((m, i) => {
                            const total = m.pm + m.insp;
                            const maxTotal = Math.max(...topMolds.map(x => x.pm + x.insp), 1);
                            const pct = Math.round((total / maxTotal) * 100);
                            return h('div', { key: m.mold, className: 'flex items-center gap-3' },
                                h('div', { className: 'w-5 text-center text-xs text-surface-500 font-bold' }, `#${i+1}`),
                                h('div', { className: 'flex-1 min-w-0' },
                                    h('div', { className: 'flex justify-between items-center mb-1' },
                                        h('span', { className: 'text-xs font-bold text-primary-400 truncate' }, m.mold),
                                        h('span', { className: 'text-xs text-surface-400 ml-2 flex-shrink-0' },
                                            h('span', { className: 'text-indigo-400' }, `PM:${m.pm}`),
                                            ' ',
                                            h('span', { className: 'text-cyan-400' }, `Ins:${m.insp}`)
                                        )
                                    ),
                                    h('div', { className: 'h-1.5 bg-white/5 rounded-full overflow-hidden' },
                                        h('div', { className: 'h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all', style: { width: `${pct}%` } })
                                    )
                                )
                            );
                        })
                    )
            )
        ),

        // ── Summary stats bar ──────────────────────────────
        h('div', { className: 'card bg-surface-800/50' },
            h('div', { className: 'flex flex-wrap gap-6 items-center justify-between' },
                h('div', { className: 'text-xs text-surface-500 font-semibold uppercase' },
                    h('i', { className: 'fa-solid fa-info-circle mr-1 text-primary-400' }),
                    `สถิติสรุป — ${periodLabel}`
                ),
                ...[
                    { label: 'PM รายการ', val: pmFiltered.length, color: 'text-indigo-400' },
                    { label: 'PM Items ทั้งหมด', val: pmStats.total, color: 'text-indigo-300' },
                    { label: 'PM Pass Rate', val: `${pmStats.passRate}%`, color: 'text-emerald-400' },
                    { label: 'Inspection รายการ', val: inspFiltered.length, color: 'text-cyan-400' },
                    { label: 'Inspection Items', val: inspStats.total, color: 'text-cyan-300' },
                    { label: 'Insp Pass Rate', val: `${inspStats.passRate}%`, color: 'text-emerald-400' },
                ].map((s, i) =>
                    h('div', { key: i, className: 'text-center' },
                        h('p', { className: `text-lg font-bold ${s.color}` }, s.val),
                        h('p', { className: 'text-[10px] text-surface-500' }, s.label)
                    )
                )
            )
        )
    );
}

window.DashboardPage = DashboardPage;
