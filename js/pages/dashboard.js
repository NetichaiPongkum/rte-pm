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
    const [moldsMap, setMoldsMap] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('pm'); // 'pm' or 'inspection'
    const [filterSearch, setFilterSearch] = React.useState('');
    const [pmYearlyYear, setPmYearlyYear] = React.useState(new Date().getFullYear().toString());
    const [inspYearlyYear, setInspYearlyYear] = React.useState(new Date().getFullYear().toString());
    const [showPmYearlyModal, setShowPmYearlyModal] = React.useState(false);
    const [showInspYearlyModal, setShowInspYearlyModal] = React.useState(false);

    // Recharts components
    const RC = window.Recharts || {};
    const {
        BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
        XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
    } = RC;

    React.useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                const [pmRes, inspRes, moldsRes] = await Promise.all([
                    window.supabaseClient.from('pm_checklist_records').select('*').order('performed_date', { ascending: true }),
                    window.supabaseClient.from('inspection_records').select('*').order('performed_date', { ascending: true }),
                    window.supabaseClient.from('mold_master').select('mold_code, mold_name, dwg_part1')
                ]);
                setPmRecords(pmRes.data || []);
                setInspRecords(inspRes.data || []);
                
                const map = {};
                (moldsRes.data || []).forEach(m => { map[m.mold_code] = { name: m.mold_name, dwg: m.dwg_part1 }; });
                setMoldsMap(map);
            } else {
                setPmRecords(JSON.parse(localStorage.getItem('demo_pm_records') || '[]'));
                setInspRecords(JSON.parse(localStorage.getItem('demo_inspection_records') || '[]'));
                setMoldsMap({});
            }
        } catch (e) { showToast('โหลดข้อมูลล้มเหลว', 'error'); }
        finally { setLoading(false); }
    };

    // ── Filter helpers ──────────────────────────────
    const filterRecords = (recs) => {
        let filtered = recs;
        if (period === 'daily') filtered = filtered.filter(r => (r.performed_date || '') === selectedDate);
        if (period === 'monthly') filtered = filtered.filter(r => (r.performed_date || '').startsWith(selectedMonth));
        if (period === 'yearly') filtered = filtered.filter(r => (r.performed_date || '').startsWith(selectedYear));
        
        if (filterSearch.trim()) {
            const q = filterSearch.toLowerCase();
            filtered = filtered.filter(r => {
                const moldInfo = moldsMap[r.mold_code] || {};
                const moldCodeMatch = (r.mold_code || '').toLowerCase().includes(q);
                const dwgMatch = (moldInfo.dwg || '').toLowerCase().includes(q);
                return moldCodeMatch || dwgMatch;
            });
        }
        return filtered;
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

    const pmTrendData = pmTrend.map(d => ({
        label: d.label.length === 10 ? d.label.slice(5) : d.label,
        count: d.count,
        pass: d.pass,
        fail: d.fail
    }));
    const inspTrendData = inspTrend.map(d => ({
        label: d.label.length === 10 ? d.label.slice(5) : d.label,
        count: d.count,
        pass: d.pass,
        fail: d.fail
    }));

    // ── Yearly-specific data calculations ───────────
    const MONTH_NAMES_TH = {
        '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
        '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
        '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.'
    };
    const formatMonthLabel = (labelStr) => {
        if (labelStr && labelStr.length === 7) {
            const m = labelStr.slice(5);
            return MONTH_NAMES_TH[m] || m;
        }
        return labelStr;
    };

    const filterRecordsYearly = (recs, yearVal) => {
        let filtered = recs.filter(r => (r.performed_date || '').startsWith(yearVal));
        if (filterSearch.trim()) {
            const q = filterSearch.toLowerCase();
            filtered = filtered.filter(r => {
                const moldInfo = moldsMap[r.mold_code] || {};
                const moldCodeMatch = (r.mold_code || '').toLowerCase().includes(q);
                const dwgMatch = (moldInfo.dwg || '').toLowerCase().includes(q);
                return moldCodeMatch || dwgMatch;
            });
        }
        return filtered;
    };

    const pmFilteredYearly = filterRecordsYearly(pmRecords, pmYearlyYear);
    const inspFilteredYearly = filterRecordsYearly(inspRecords, inspYearlyYear);

    const pmYearlyStats   = calcStats(pmFilteredYearly);
    const inspYearlyStats = calcStats(inspFilteredYearly);

    const pmYearlyTrend   = buildTrend(pmFilteredYearly, d => d.slice(0, 7));
    const inspYearlyTrend = buildTrend(inspFilteredYearly, d => d.slice(0, 7));

    const pmYearlyTrendDataFormatted = pmYearlyTrend.map(d => ({
        label: formatMonthLabel(d.label),
        count: d.count,
        pass: d.pass,
        fail: d.fail
    }));
    const inspYearlyTrendDataFormatted = inspYearlyTrend.map(d => ({
        label: formatMonthLabel(d.label),
        count: d.count,
        pass: d.pass,
        fail: d.fail
    }));

    const pmYearlyPieData   = [{ name:'Pass', value: pmYearlyStats.pass }, { name:'Fail', value: pmYearlyStats.fail }, { name:'N/A', value: pmYearlyStats.na }].filter(d=>d.value>0);
    const inspYearlyPieData = [{ name:'Pass', value: inspYearlyStats.pass }, { name:'Fail', value: inspYearlyStats.fail }, { name:'N/A', value: inspYearlyStats.na }].filter(d=>d.value>0);


    // ── PM Level breakdown ───────────────────────────
    const levelMap = {};
    pmFiltered.forEach(r => {
        const lv = r.pm_level || 'Unknown';
        levelMap[lv] = (levelMap[lv] || 0) + 1;
    });
    const levelData = Object.entries(levelMap).map(([name, value]) => ({ name: 'Level ' + name, value }));

    // ── Top molds ────────────────────────────────────
    const getTopMolds = (recs) => {
        const tempMap = {};
        recs.forEach(r => {
            const k = r.mold_code || '-';
            if (!tempMap[k]) tempMap[k] = { mold: k, name: moldsMap[k]?.name || '-', count: 0 };
            tempMap[k].count++;
        });
        return Object.values(tempMap).sort((a,b) => b.count - a.count).slice(0, 5);
    };
    
    const pmTopMolds = getTopMolds(pmFiltered);
    const inspTopMolds = getTopMolds(inspFiltered);

    // ── Problems Analysis ─────────────────────────────
    const getProblems = (recs) => {
        const pMap = {};
        recs.forEach(r => {
            (r.checklist_data || []).forEach(item => {
                if (item.result === 'fail') {
                    const name = item.name || 'Unknown';
                    pMap[name] = (pMap[name] || 0) + 1;
                }
            });
        });
        return Object.entries(pMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    };
    
    const pmProblems = getProblems(pmFiltered);
    const inspProblems = getProblems(inspFiltered);
    
    const pmProblemsTop = pmProblems.slice(0, 10);
    const inspProblemsTop = inspProblems.slice(0, 10);

    // ── Pie data ─────────────────────────────────────
    const pmPieData   = [{ name:'Pass', value: pmStats.pass }, { name:'Fail', value: pmStats.fail }, { name:'N/A', value: pmStats.na }].filter(d=>d.value>0);
    const inspPieData = [{ name:'Pass', value: inspStats.pass }, { name:'Fail', value: inspStats.fail }, { name:'N/A', value: inspStats.na }].filter(d=>d.value>0);
    const COLORS = ['#10b981', '#ef4444', '#6b7280'];
    const LEVEL_COLORS = ['#6366f1','#f59e0b','#10b981','#ec4899'];
    const PROBLEM_COLORS = ['#f43f5e', '#f97316', '#eab308', '#84cc16', '#22c55e', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f472b6'];

    // ── Period label ─────────────────────────────────
    const periodLabel = period === 'daily' ? selectedDate
        : period === 'monthly' ? selectedMonth
        : selectedYear;

    // ── KPI Card component ───────────────────────────
    const KPICard = ({ label, value, sub, icon, color, bg }) =>
        h('div', { className: `card flex items-center gap-4 hover:border-white/15 transition-all` },
            h('div', { className: `w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}` },
                h('i', { className: `fa-solid ${icon} text-2xl ${color}` })
            ),
            h('div', { className: 'min-w-0 flex-1' },
                h('p', { className: 'text-xs text-surface-400 uppercase tracking-wider font-semibold' }, label),
                h('div', { className: 'flex items-end gap-2' },
                    h('p', { className: 'text-3xl font-bold text-white' }, value),
                    sub && h('p', { className: 'text-[11px] text-surface-500 mb-1 font-medium' }, sub)
                )
            )
        );

    // ── Section Header ────────────────────────────────
    const SectionHeader = ({ title, icon, color }) =>
        h('div', { className: 'flex items-center gap-2 mb-4 border-b border-white/5 pb-2' },
            h('i', { className: `fa-solid ${icon} ${color}` }),
            h('h3', { className: 'text-base font-bold text-surface-200' }, title)
        );

    // ── Tooltip styles ────────────────────────────────
    const tooltipStyle = { backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px', padding: '8px 12px' };
    const tooltipConfig = {
        contentStyle: tooltipStyle,
        labelStyle: { color: '#ffffff' },
        itemStyle: { color: '#ffffff' }
    };

    // ── Render Tabs ───────────────────────────────────
    const TabButton = ({ id, label, icon }) =>
        h('button', {
            className: `flex-1 py-3 text-sm font-bold transition-all duration-200 border-b-2 flex items-center justify-center gap-2 ${activeTab === id ? 'border-primary-400 text-primary-400 bg-primary-500/10' : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:bg-surface-800'}`,
            onClick: () => setActiveTab(id)
        }, h('i', { className: `fa-solid ${icon}` }), label);


    // ── Yearly Modal component ─────────────────────────
    const YearlyModal = ({ isOpen, onClose, title, year, setYear, trendData, pieData, stats, isPm }) => {
        if (!isOpen) return null;
        
        return h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in' },
            h('div', { className: 'glass rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto border border-white/10 p-6 flex flex-col space-y-6 shadow-2xl relative' },
                // Close button
                h('button', {
                    className: 'absolute top-4 right-4 text-surface-400 hover:text-white transition-colors w-8 h-8 rounded-full bg-white/5 flex items-center justify-center',
                    onClick: onClose
                }, h('i', { className: 'fa-solid fa-xmark text-lg' })),
                
                // Modal Header
                h('div', { className: 'flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 pr-8' },
                    h('div', null,
                        h('h3', { className: 'text-xl font-bold text-white flex items-center gap-2' },
                            h('i', { className: `fa-solid ${isPm ? 'fa-screwdriver-wrench text-indigo-400' : 'fa-book-open text-cyan-400'}` }),
                            title
                        ),
                        h('p', { className: 'text-xs text-surface-400 mt-1' }, `วิเคราะห์ข้อมูลผลการตรวจเช็คในรูปแบบรายปี`)
                    ),
                    // Year filter
                    h('div', { className: 'flex items-center gap-2' },
                        h('span', { className: 'text-xs text-surface-400 font-medium' }, 'เลือกปี:'),
                        h('select', {
                            className: 'input text-xs py-1 px-3 border border-white/10 bg-surface-900 rounded-md font-semibold text-white w-28',
                            value: year,
                            onChange: e => setYear(e.target.value)
                        }, ['2023','2024','2025','2026','2027'].map(y => h('option', { key: y, value: y }, y)))
                    )
                ),
                
                // Charts Grid
                h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
                    // Trend Line (spanning 2 columns)
                    h('div', { className: 'card lg:col-span-2 shadow-sm bg-surface-950/40' },
                        h(SectionHeader, { title: `แนวโน้มการทำ ${isPm ? 'PM' : 'Inspection'} (Pass vs Fail) ปี ${year}`, icon: 'fa-chart-area', color: isPm ? 'text-indigo-400' : 'text-cyan-400' }),
                        trendData.length === 0
                            ? h('div', { className: 'flex items-center justify-center h-64 text-surface-500 text-sm' }, 'ไม่มีข้อมูลในช่วงปีนี้')
                            : h(ResponsiveContainer, { width: '100%', height: 320 },
                                h(LineChart, { data: trendData, margin: { top: 10, right: 10, left: -20, bottom: 5 } },
                                    h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false }),
                                    h(XAxis, { dataKey: 'label', tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false, dy: 10 }),
                                    h(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                    h(Tooltip, tooltipConfig),
                                    h(Legend, { wrapperStyle: { fontSize: '12px', paddingTop: '10px' } }),
                                    h(Line, { type: 'monotone', dataKey: 'pass', name: 'Pass Items', stroke: '#10b981', strokeWidth: 3, dot: { r: 4, fill: '#10b981' }, activeDot: { r: 6 } }),
                                    h(Line, { type: 'monotone', dataKey: 'fail', name: 'Fail Items', stroke: '#f43f5e', strokeWidth: 3, dot: { r: 4, fill: '#f43f5e' }, activeDot: { r: 6 } })
                                )
                            )
                    ),
                    
                    // Pie Chart (1 column)
                    h('div', { className: 'card shadow-sm flex flex-col bg-surface-950/40' },
                        h(SectionHeader, { title: `สัดส่วนผลการตรวจ ปี ${year}`, icon: 'fa-chart-pie', color: isPm ? 'text-indigo-400' : 'text-cyan-400' }),
                        pieData.length === 0
                            ? h('div', { className: 'flex-1 flex items-center justify-center text-surface-500 text-sm min-h-[220px]' }, 'ไม่มีข้อมูล')
                            : h(React.Fragment, null,
                                h('div', { className: 'flex-1 min-h-[220px]' },
                                    h(ResponsiveContainer, { width: '100%', height: '100%' },
                                        h(PieChart, null,
                                            h(Pie, { data: pieData, cx: '50%', cy: '50%', innerRadius: 60, outerRadius: 90, paddingAngle: 5, dataKey: 'value' },
                                                pieData.map((_, i) => h(Cell, { key: i, fill: COLORS[i] }))
                                            ),
                                            h(Tooltip, tooltipConfig)
                                        )
                                    )
                                ),
                                h('div', { className: 'grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5' },
                                    h('div', { className: 'text-center' }, h('p', { className: 'text-emerald-400 font-bold text-lg' }, stats.pass), h('p', { className: 'text-xs text-surface-500' }, 'Pass')),
                                    h('div', { className: 'text-center border-x border-white/5' }, h('p', { className: 'text-rose-400 font-bold text-lg' }, stats.fail), h('p', { className: 'text-xs text-surface-500' }, 'Fail')),
                                    h('div', { className: 'text-center' }, h('p', { className: 'text-surface-400 font-bold text-lg' }, stats.na), h('p', { className: 'text-xs text-surface-500' }, 'N/A'))
                                )
                            )
                    )
                )
            )
        );
    };


    if (loading) return h('div', { className: 'flex items-center justify-center min-h-[60vh]' },
        h('div', { className: 'loading-spinner' })
    );

    return h(React.Fragment, null,
        h('div', { className: 'space-y-6 animate-fade-in pb-8' },

        // ── Header Controls ────────────────────────────
        h('div', { className: 'card flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 mb-2' },
            h('div', null,
                h('h2', { className: 'text-2xl font-black text-white tracking-tight' }, 'Engineering Analytics'),
                h('p', { className: 'text-sm text-surface-400 mt-1 font-medium' }, `ภาพรวมการบำรุงรักษาและตรวจสอบแม่พิมพ์ — ${periodLabel}`)
            ),
            h('div', { className: 'flex flex-wrap items-center gap-3' },
                // Filter input
                h('div', { className: 'relative' },
                    h('input', { 
                        type: 'text', 
                        className: 'input text-sm py-1.5 pl-8 w-40 md:w-48 border border-white/10 bg-surface-900', 
                        placeholder: 'ค้นหารหัสแม่พิมพ์/DWG',
                        value: filterSearch,
                        onChange: e => setFilterSearch(e.target.value)
                    }),
                    h('i', { className: 'fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500 text-xs' })
                ),
                // Period selector
                h('div', { className: 'flex bg-surface-900 rounded-lg p-1 border border-white/5' },
                    ['daily','monthly','yearly'].map(p =>
                        h('button', {
                            key: p,
                            className: `px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${period === p ? 'bg-primary-500 text-white shadow-sm' : 'text-surface-400 hover:text-white'}`,
                            onClick: () => setPeriod(p)
                        }, p === 'daily' ? 'รายวัน' : p === 'monthly' ? 'รายเดือน' : 'รายปี')
                    )
                ),
                // Date picker
                period === 'daily' && h('input', { type: 'date', className: 'input text-sm py-1.5 w-40 border border-white/10 bg-surface-900', value: selectedDate, onChange: e => setSelectedDate(e.target.value) }),
                period === 'monthly' && h('input', { type: 'month', className: 'input text-sm py-1.5 w-40 border border-white/10 bg-surface-900', value: selectedMonth, onChange: e => setSelectedMonth(e.target.value) }),
                period === 'yearly' && h('select', { className: 'input text-sm py-1.5 w-32 border border-white/10 bg-surface-900', value: selectedYear, onChange: e => setSelectedYear(e.target.value) },
                    ['2023','2024','2025','2026','2027'].map(y => h('option', { key: y, value: y }, y))
                ),
                h('button', { className: 'btn btn-ghost btn-sm text-surface-400 hover:text-white', onClick: loadData, title: 'Refresh' },
                    h('i', { className: 'fa-solid fa-sync' })
                )
            )
        ),

        // ── Tabs Navigation ────────────────────────────
        h('div', { className: 'flex rounded-t-xl overflow-hidden bg-surface-900/50 border-b border-surface-700 mt-4' },
            h(TabButton, { id: 'pm', label: 'PM Analytics', icon: 'fa-screwdriver-wrench' }),
            h(TabButton, { id: 'inspection', label: 'Inspection Analytics', icon: 'fa-book-open' })
        ),

        // ==============================================================
        // PM ANALYTICS TAB
        // ==============================================================
        activeTab === 'pm' && h('div', { className: 'space-y-6 animate-fade-in' },
            // ── PM KPIs ──
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' },
                h(KPICard, { label: 'รายการ PM ทั้งหมด', value: pmFiltered.length, sub: 'รายการ', icon: 'fa-clipboard-list', color: 'text-indigo-400', bg: 'bg-indigo-500/10' }),
                h(KPICard, { label: 'อัตราส่วนที่ผ่าน (Pass Rate)', value: `${pmStats.passRate}%`, sub: `จากทั้งหมด ${pmStats.total} ไอเท็ม`, icon: 'fa-chart-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }),
                h(KPICard, { label: 'ไอเท็มที่ผ่าน', value: pmStats.pass, sub: 'ไอเท็มย่อย (Items)', icon: 'fa-check-circle', color: 'text-emerald-500', bg: 'bg-emerald-500/5' }),
                h(KPICard, { label: 'ไอเท็มที่ไม่ผ่าน', value: pmStats.fail, sub: 'ไอเท็มย่อย (Items)', icon: 'fa-triangle-exclamation', color: 'text-rose-400', bg: 'bg-rose-500/10' })
            ),

            // ── PM Yearly Row ──
            h('div', { className: 'flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-1 border-b border-white/5 pb-2' },
                h('div', { className: 'flex items-center gap-2' },
                    h('i', { className: 'fa-solid fa-calendar-check text-indigo-400' }),
                    h('h3', { className: 'text-base font-bold text-surface-200' }, `ภาพรวมการตรวจสอบ PM รายปี (${pmYearlyYear})`)
                ),
                h('div', { className: 'flex items-center gap-3' },
                    h('span', { className: 'text-xs text-surface-400 font-medium' }, 'เลือกปี:'),
                    h('select', {
                        className: 'input text-xs py-1 px-2 border border-white/10 bg-surface-900 rounded-md font-semibold text-white w-24',
                        value: pmYearlyYear,
                        onChange: e => setPmYearlyYear(e.target.value)
                    }, ['2023','2024','2025','2026','2027'].map(y => h('option', { key: y, value: y }, y))),
                    h('button', {
                        className: 'btn btn-secondary btn-xs flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-md transition-all font-semibold',
                        onClick: () => setShowPmYearlyModal(true)
                    }, h('i', { className: 'fa-solid fa-expand' }), 'แสดงหน้าต่างแยก')
                )
            ),
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
                // Trend Line
                h('div', { className: 'card lg:col-span-2 shadow-sm' },
                    h(SectionHeader, { title: `แนวโน้มการทำ PM (Pass vs Fail) ปี ${pmYearlyYear}`, icon: 'fa-chart-area', color: 'text-indigo-400' }),
                    pmYearlyTrendDataFormatted.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-56 text-surface-500 text-sm' }, 'ไม่มีข้อมูลในช่วงปีนี้')
                        : h(ResponsiveContainer, { width: '100%', height: 260 },
                            h(LineChart, { data: pmYearlyTrendDataFormatted, margin: { top: 10, right: 10, left: -20, bottom: 5 } },
                                h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false }),
                                h(XAxis, { dataKey: 'label', tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false, dy: 10 }),
                                h(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(Tooltip, tooltipConfig),
                                h(Legend, { wrapperStyle: { fontSize: '12px', paddingTop: '10px' } }),
                                h(Line, { type: 'monotone', dataKey: 'pass', name: 'Pass Items', stroke: '#10b981', strokeWidth: 3, dot: { r: 3, fill: '#10b981' }, activeDot: { r: 5 } }),
                                h(Line, { type: 'monotone', dataKey: 'fail', name: 'Fail Items', stroke: '#f43f5e', strokeWidth: 3, dot: { r: 3, fill: '#f43f5e' }, activeDot: { r: 5 } })
                            )
                        )
                ),
                // Pie Chart
                h('div', { className: 'card shadow-sm flex flex-col' },
                    h(SectionHeader, { title: `สัดส่วนผลการตรวจ PM ปี ${pmYearlyYear}`, icon: 'fa-chart-pie', color: 'text-indigo-400' }),
                    pmYearlyPieData.length === 0
                        ? h('div', { className: 'flex-1 flex items-center justify-center text-surface-500 text-sm min-h-[200px]' }, 'ไม่มีข้อมูล')
                        : h(React.Fragment, null,
                            h('div', { className: 'flex-1 min-h-[200px]' },
                                h(ResponsiveContainer, { width: '100%', height: '100%' },
                                    h(PieChart, null,
                                        h(Pie, { data: pmYearlyPieData, cx: '50%', cy: '50%', innerRadius: 55, outerRadius: 85, paddingAngle: 5, dataKey: 'value' },
                                            pmYearlyPieData.map((_, i) => h(Cell, { key: i, fill: COLORS[i] }))
                                        ),
                                        h(Tooltip, tooltipConfig)
                                    )
                                )
                            ),
                            h('div', { className: 'grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5' },
                                h('div', { className: 'text-center' }, h('p', { className: 'text-emerald-400 font-bold text-lg' }, pmYearlyStats.pass), h('p', { className: 'text-xs text-surface-500' }, 'Pass')),
                                h('div', { className: 'text-center border-x border-white/5' }, h('p', { className: 'text-rose-400 font-bold text-lg' }, pmYearlyStats.fail), h('p', { className: 'text-xs text-surface-500' }, 'Fail')),
                                h('div', { className: 'text-center' }, h('p', { className: 'text-surface-400 font-bold text-lg' }, pmYearlyStats.na), h('p', { className: 'text-xs text-surface-500' }, 'N/A'))
                            )
                        )
                )
            ),

            // ── PM Charts Row 2 ──
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
                // Bar Chart: Levels
                h('div', { className: 'card shadow-sm' },
                    h(SectionHeader, { title: 'จำแนกตามระดับ PM (Level)', icon: 'fa-layer-group', color: 'text-indigo-400' }),
                    levelData.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                        : h(ResponsiveContainer, { width: '100%', height: 240 },
                            h(BarChart, { data: levelData, layout: 'vertical', margin: { top: 5, right: 20, left: 10, bottom: 5 } },
                                h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', horizontal: false }),
                                h(XAxis, { type: 'number', tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(YAxis, { type: 'category', dataKey: 'name', tick: { fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }, axisLine: false, tickLine: false, width: 70 }),
                                h(Tooltip, { ...tooltipConfig, cursor: { fill: 'rgba(255,255,255,0.05)' } }),
                                h(Bar, { dataKey: 'value', name: 'จำนวนรายการ', radius: [0,4,4,0], barSize: 24 },
                                    levelData.map((_, i) => h(Cell, { key: i, fill: LEVEL_COLORS[i % LEVEL_COLORS.length] }))
                                )
                            )
                        )
                ),
                // Pie Chart: Level Proportion
                h('div', { className: 'card shadow-sm flex flex-col' },
                    h(SectionHeader, { title: 'สัดส่วน Level การทำ PM', icon: 'fa-chart-pie', color: 'text-indigo-400' }),
                    levelData.length === 0
                        ? h('div', { className: 'flex-1 flex items-center justify-center text-surface-500 text-sm min-h-[200px]' }, 'ไม่มีข้อมูล')
                        : h(ResponsiveContainer, { width: '100%', height: 240 },
                            h(PieChart, null,
                                h(Pie, { data: levelData, cx: '50%', cy: '50%', innerRadius: 55, outerRadius: 80, paddingAngle: 5, dataKey: 'value' },
                                    levelData.map((_, i) => h(Cell, { key: i, fill: LEVEL_COLORS[i % LEVEL_COLORS.length] }))
                                ),
                                h(Tooltip, tooltipConfig),
                                h(Legend, { wrapperStyle: { fontSize: '11px', paddingTop: '10px' }, iconSize: 8 })
                            )
                        )
                )
            ),

            // ── PM Charts Row 3: Problems ──
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
                h('div', { className: 'card lg:col-span-2 shadow-sm' },
                    h(SectionHeader, { title: 'ปัญหาที่พบ (Fail Items)', icon: 'fa-triangle-exclamation', color: 'text-rose-400' }),
                    pmProblemsTop.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูลปัญหา')
                        : h(ResponsiveContainer, { width: '100%', height: 260 },
                            h(BarChart, { data: pmProblemsTop, margin: { top: 10, right: 10, left: -20, bottom: 5 } },
                                h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false }),
                                h(XAxis, { dataKey: 'name', tick: { fill: '#94a3b8', fontSize: 10 }, axisLine: false, tickLine: false, tickFormatter: (v) => v.length > 15 ? v.substring(0, 15) + '...' : v }),
                                h(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(Tooltip, { ...tooltipConfig, cursor: { fill: 'rgba(255,255,255,0.05)' } }),
                                h(Bar, { dataKey: 'value', name: 'จำนวนปัญหา (ครั้ง)', radius: [4,4,0,0], barSize: 32 },
                                    pmProblemsTop.map((_, i) => h(Cell, { key: i, fill: PROBLEM_COLORS[i % PROBLEM_COLORS.length] }))
                                )
                            )
                        )
                ),
                h('div', { className: 'card shadow-sm' },
                    h(SectionHeader, { title: 'สัดส่วนของปัญหา', icon: 'fa-chart-pie', color: 'text-rose-400' }),
                    pmProblemsTop.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูลปัญหา')
                        : h(ResponsiveContainer, { width: '100%', height: 260 },
                            h(PieChart, null,
                                h(Pie, { data: pmProblemsTop, cx: '50%', cy: '50%', outerRadius: 85, paddingAngle: 2, dataKey: 'value', label: false },
                                    pmProblemsTop.map((_, i) => h(Cell, { key: i, fill: PROBLEM_COLORS[i % PROBLEM_COLORS.length] }))
                                ),
                                h(Tooltip, { ...tooltipConfig, formatter: (value, name) => [value, name] }),
                                h(Legend, { wrapperStyle: { fontSize: '11px', overflow: 'hidden', maxHeight: '100px' }, iconSize: 8 })
                            )
                        )
                )
            )
        ),

        // ==============================================================
        // INSPECTION ANALYTICS TAB
        // ==============================================================
        activeTab === 'inspection' && h('div', { className: 'space-y-6 animate-fade-in' },
            // ── Inspection KPIs ──
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4' },
                h(KPICard, { label: 'รายการ Inspection ทั้งหมด', value: inspFiltered.length, sub: 'รายการ', icon: 'fa-clipboard-check', color: 'text-cyan-400', bg: 'bg-cyan-500/10' }),
                h(KPICard, { label: 'อัตราส่วนที่ผ่าน (Pass Rate)', value: `${inspStats.passRate}%`, sub: `จากทั้งหมด ${inspStats.total} ไอเท็ม`, icon: 'fa-chart-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }),
                h(KPICard, { label: 'ไอเท็มที่ผ่าน', value: inspStats.pass, sub: 'ไอเท็มย่อย (Items)', icon: 'fa-check-circle', color: 'text-emerald-500', bg: 'bg-emerald-500/5' }),
                h(KPICard, { label: 'ไอเท็มที่ไม่ผ่าน', value: inspStats.fail, sub: 'ไอเท็มย่อย (Items)', icon: 'fa-triangle-exclamation', color: 'text-rose-400', bg: 'bg-rose-500/10' })
            ),

            // ── Inspection Yearly Row ──
            h('div', { className: 'flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 mb-1 border-b border-white/5 pb-2' },
                h('div', { className: 'flex items-center gap-2' },
                    h('i', { className: 'fa-solid fa-calendar-check text-cyan-400' }),
                    h('h3', { className: 'text-base font-bold text-surface-200' }, `ภาพรวมการตรวจสอบ Inspection รายปี (${inspYearlyYear})`)
                ),
                h('div', { className: 'flex items-center gap-3' },
                    h('span', { className: 'text-xs text-surface-400 font-medium' }, 'เลือกปี:'),
                    h('select', {
                        className: 'input text-xs py-1 px-2 border border-white/10 bg-surface-900 rounded-md font-semibold text-white w-24',
                        value: inspYearlyYear,
                        onChange: e => setInspYearlyYear(e.target.value)
                    }, ['2023','2024','2025','2026','2027'].map(y => h('option', { key: y, value: y }, y))),
                    h('button', {
                        className: 'btn btn-secondary btn-xs flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-md transition-all font-semibold',
                        onClick: () => setShowInspYearlyModal(true)
                    }, h('i', { className: 'fa-solid fa-expand' }), 'แสดงหน้าต่างแยก')
                )
            ),
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
                // Trend Line
                h('div', { className: 'card lg:col-span-2 shadow-sm' },
                    h(SectionHeader, { title: `แนวโน้มการ Inspection (Pass vs Fail) ปี ${inspYearlyYear}`, icon: 'fa-chart-area', color: 'text-cyan-400' }),
                    inspYearlyTrendDataFormatted.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-56 text-surface-500 text-sm' }, 'ไม่มีข้อมูลในช่วงปีนี้')
                        : h(ResponsiveContainer, { width: '100%', height: 260 },
                            h(LineChart, { data: inspYearlyTrendDataFormatted, margin: { top: 10, right: 10, left: -20, bottom: 5 } },
                                h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false }),
                                h(XAxis, { dataKey: 'label', tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false, dy: 10 }),
                                h(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(Tooltip, tooltipConfig),
                                h(Legend, { wrapperStyle: { fontSize: '12px', paddingTop: '10px' } }),
                                h(Line, { type: 'monotone', dataKey: 'pass', name: 'Pass Items', stroke: '#10b981', strokeWidth: 3, dot: { r: 3, fill: '#10b981' }, activeDot: { r: 5 } }),
                                h(Line, { type: 'monotone', dataKey: 'fail', name: 'Fail Items', stroke: '#f43f5e', strokeWidth: 3, dot: { r: 3, fill: '#f43f5e' }, activeDot: { r: 5 } })
                            )
                        )
                ),
                // Pie Chart
                h('div', { className: 'card shadow-sm flex flex-col' },
                    h(SectionHeader, { title: `สัดส่วนผลการ Inspection ปี ${inspYearlyYear}`, icon: 'fa-chart-pie', color: 'text-cyan-400' }),
                    inspYearlyPieData.length === 0
                        ? h('div', { className: 'flex-1 flex items-center justify-center text-surface-500 text-sm min-h-[200px]' }, 'ไม่มีข้อมูล')
                        : h(React.Fragment, null,
                            h('div', { className: 'flex-1 min-h-[200px]' },
                                h(ResponsiveContainer, { width: '100%', height: '100%' },
                                    h(PieChart, null,
                                        h(Pie, { data: inspYearlyPieData, cx: '50%', cy: '50%', innerRadius: 55, outerRadius: 85, paddingAngle: 5, dataKey: 'value' },
                                            inspYearlyPieData.map((_, i) => h(Cell, { key: i, fill: COLORS[i] }))
                                        ),
                                        h(Tooltip, tooltipConfig)
                                    )
                                )
                            ),
                            h('div', { className: 'grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5' },
                                h('div', { className: 'text-center' }, h('p', { className: 'text-emerald-400 font-bold text-lg' }, inspYearlyStats.pass), h('p', { className: 'text-xs text-surface-500' }, 'Pass')),
                                h('div', { className: 'text-center border-x border-white/5' }, h('p', { className: 'text-rose-400 font-bold text-lg' }, inspYearlyStats.fail), h('p', { className: 'text-xs text-surface-500' }, 'Fail')),
                                h('div', { className: 'text-center' }, h('p', { className: 'text-surface-400 font-bold text-lg' }, inspYearlyStats.na), h('p', { className: 'text-xs text-surface-500' }, 'N/A'))
                            )
                        )
                )
            ),

            // ── Insp Charts Row 2 ──
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
                // Insp Empty Placeholder for balance if needed, or total timeline
                h('div', { className: 'card shadow-sm' },
                    h(SectionHeader, { title: 'ปริมาณการ Inspection', icon: 'fa-chart-column', color: 'text-cyan-400' }),
                    inspTrendData.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                        : h(ResponsiveContainer, { width: '100%', height: 240 },
                            h(BarChart, { data: inspTrendData, margin: { top: 10, right: 10, left: -20, bottom: 5 } },
                                h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false }),
                                h(XAxis, { dataKey: 'label', tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(Tooltip, { ...tooltipConfig, cursor: { fill: 'rgba(255,255,255,0.05)' } }),
                                h(Bar, { dataKey: 'count', name: 'จำนวนรายการ', fill: '#06b6d4', radius: [4,4,0,0], barSize: 32 })
                            )
                        )
                ),
                // Table: Top Molds
                h('div', { className: 'card shadow-sm' },
                    h(SectionHeader, { title: 'แม่พิมพ์ที่รับการ Inspection สูงสุด 5 อันดับ', icon: 'fa-trophy', color: 'text-amber-400' }),
                    inspTopMolds.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูล')
                        : h('div', { className: 'space-y-4 mt-4' },
                            inspTopMolds.map((m, i) => {
                                const maxCount = Math.max(...inspTopMolds.map(x => x.count), 1);
                                const pct = Math.round((m.count / maxCount) * 100);
                                return h('div', { key: m.mold, className: 'flex items-center gap-4 group' },
                                    h('div', { className: 'w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-400 group-hover:text-white group-hover:bg-cyan-500 transition-colors' }, i+1),
                                    h('div', { className: 'flex-1 min-w-0' },
                                        h('div', { className: 'flex justify-between items-center mb-1.5' },
                                            h('div', { className: 'min-w-0 flex-1 pr-2' },
                                                h('p', { className: 'text-sm font-bold text-white truncate leading-tight' }, m.mold),
                                                h('p', { className: 'text-[11px] text-surface-400 truncate leading-tight' }, m.name)
                                            ),
                                            h('span', { className: 'text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 whitespace-nowrap' }, `${m.count} ครั้ง`)
                                        ),
                                        h('div', { className: 'h-2 bg-surface-800 rounded-full overflow-hidden' },
                                            h('div', { className: 'h-full bg-cyan-500 rounded-full transition-all', style: { width: `${pct}%` } })
                                        )
                                    )
                                );
                            })
                        )
                )
            ),

            // ── Insp Charts Row 3: Problems ──
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
                h('div', { className: 'card lg:col-span-2 shadow-sm' },
                    h(SectionHeader, { title: 'ปัญหาที่พบ (Fail Items)', icon: 'fa-triangle-exclamation', color: 'text-rose-400' }),
                    inspProblemsTop.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูลปัญหา')
                        : h(ResponsiveContainer, { width: '100%', height: 260 },
                            h(BarChart, { data: inspProblemsTop, margin: { top: 10, right: 10, left: -20, bottom: 5 } },
                                h(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.05)', vertical: false }),
                                h(XAxis, { dataKey: 'name', tick: { fill: '#94a3b8', fontSize: 10 }, axisLine: false, tickLine: false, tickFormatter: (v) => v.length > 15 ? v.substring(0, 15) + '...' : v }),
                                h(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 }, axisLine: false, tickLine: false }),
                                h(Tooltip, { ...tooltipConfig, cursor: { fill: 'rgba(255,255,255,0.05)' } }),
                                h(Bar, { dataKey: 'value', name: 'จำนวนปัญหา (ครั้ง)', radius: [4,4,0,0], barSize: 32 },
                                    inspProblemsTop.map((_, i) => h(Cell, { key: i, fill: PROBLEM_COLORS[i % PROBLEM_COLORS.length] }))
                                )
                            )
                        )
                ),
                h('div', { className: 'card shadow-sm' },
                    h(SectionHeader, { title: 'สัดส่วนของปัญหา', icon: 'fa-chart-pie', color: 'text-rose-400' }),
                    inspProblemsTop.length === 0
                        ? h('div', { className: 'flex items-center justify-center h-48 text-surface-500 text-sm' }, 'ไม่มีข้อมูลปัญหา')
                        : h(ResponsiveContainer, { width: '100%', height: 260 },
                            h(PieChart, null,
                                h(Pie, { data: inspProblemsTop, cx: '50%', cy: '50%', outerRadius: 85, paddingAngle: 2, dataKey: 'value', label: false },
                                    inspProblemsTop.map((_, i) => h(Cell, { key: i, fill: PROBLEM_COLORS[i % PROBLEM_COLORS.length] }))
                                ),
                                h(Tooltip, { ...tooltipConfig, formatter: (value, name) => [value, name] }),
                                h(Legend, { wrapperStyle: { fontSize: '11px', overflow: 'hidden', maxHeight: '100px' }, iconSize: 8 })
                            )
                        )
                )
            )
        ),
        // PM Yearly Modal
        h(YearlyModal, {
            isOpen: showPmYearlyModal,
            onClose: () => setShowPmYearlyModal(false),
            title: 'ภาพรวมรายปี PM Analytics',
            year: pmYearlyYear,
            setYear: setPmYearlyYear,
            trendData: pmYearlyTrendDataFormatted,
            pieData: pmYearlyPieData,
            stats: pmYearlyStats,
            isPm: true
        }),
        // Inspection Yearly Modal
        h(YearlyModal, {
            isOpen: showInspYearlyModal,
            onClose: () => setShowInspYearlyModal(false),
            title: 'ภาพรวมรายปี Inspection Analytics',
            year: inspYearlyYear,
            setYear: setInspYearlyYear,
            trendData: inspYearlyTrendDataFormatted,
            pieData: inspYearlyPieData,
            stats: inspYearlyStats,
            isPm: false
        })
    );
}

window.DashboardPage = DashboardPage;
