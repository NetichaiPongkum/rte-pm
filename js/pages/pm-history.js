// ==========================================
// PM HISTORY PAGE - Summary of completed PMs
// ==========================================

function PMHistoryPage({ user, showToast }) {
    const h = React.createElement;
    const [records, setRecords] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');

    React.useEffect(() => {
        loadRecords();
    }, []);

    const loadRecords = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient
                    .from('pm_checklist_records')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                setRecords(data || []);
            } else {
                // Load from localStorage for demo mode
                const demoRecords = JSON.parse(localStorage.getItem('demo_pm_records') || '[]');
                setRecords(demoRecords);
            }
        } catch (err) {
            console.error('Load records error:', err);
            showToast('โหลดข้อมูลประวัติล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const getTypeInfo = (id) => (window.CHECKLIST_TYPES || []).find(t => t.id === id) || { label: id, icon: 'fa-list', color: 'from-gray-500 to-gray-600' };

    const filteredRecords = records.filter(r => {
        const matchesSearch = (r.mold_code || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (r.template_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || r.checklist_type === filterType;
        return matchesSearch && matchesType;
    });

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
            h('div', null,
                h('h2', { className: 'text-lg font-semibold' }, 'รายการ PM (Summary)'),
                h('p', { className: 'text-sm text-surface-400' }, 'ประวัติการตรวจสอบแม่พิมพ์ทั้งหมด')
            ),
            h('button', { className: 'btn btn-secondary btn-sm', onClick: loadRecords },
                h('i', { className: 'fa-solid fa-sync mr-2' }), 'รีเฟรช'
            )
        ),

        // Filters
        h('div', { className: 'card flex flex-col md:flex-row gap-4 items-center justify-between' },
            h('div', { className: 'relative w-full md:w-64' },
                h('i', { className: 'fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm' }),
                h('input', {
                    className: 'input pl-10',
                    placeholder: 'ค้นหารหัสแม่พิมพ์...',
                    value: searchTerm,
                    onChange: e => setSearchTerm(e.target.value)
                })
            ),
            h('div', { className: 'flex gap-2 w-full md:w-auto overflow-x-auto' },
                h('button', {
                    className: `btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}`,
                    onClick: () => setFilterType('all')
                }, 'ทั้งหมด'),
                ...(window.CHECKLIST_TYPES || []).map(type =>
                    h('button', {
                        key: type.id,
                        className: `btn btn-sm ${filterType === type.id ? 'btn-primary' : 'btn-ghost'}`,
                        onClick: () => setFilterType(type.id)
                    }, type.label)
                )
            )
        ),

        // Table
        h('div', { className: 'card overflow-hidden p-0' },
            h('div', { className: 'overflow-x-auto' },
                h('table', { className: 'data-table' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'วันที่'),
                            h('th', null, 'รหัสแม่พิมพ์'),
                            h('th', null, 'ประเภท'),
                            h('th', null, 'รายการตรวจสอบ'),
                            h('th', null, 'ผลลัพธ์ (P/F/NA)'),
                            h('th', null, 'ผู้ตรวจสอบ'),
                            h('th', null, 'สถานะ')
                        )
                    ),
                    h('tbody', null,
                        loading
                            ? h('tr', null, h('td', { colSpan: 7, className: 'text-center py-10' }, h('div', { className: 'loading-spinner mx-auto' })))
                            : filteredRecords.length === 0
                                ? h('tr', null, h('td', { colSpan: 7, className: 'text-center py-10 text-surface-500' }, 'ไม่พบข้อมูลรายการ PM'))
                                : filteredRecords.map((r, i) => {
                                    const typeInfo = getTypeInfo(r.checklist_type);
                                    return h('tr', { key: r.id, className: 'animate-slide-up', style: { animationDelay: (i * 30) + 'ms' } },
                                        h('td', null, h('span', { className: 'text-xs' }, r.performed_date || '-')),
                                        h('td', null, h('span', { className: 'font-bold text-primary-400' }, r.mold_code)),
                                        h('td', null, 
                                            h('span', { className: 'badge badge-primary text-[10px]' }, typeInfo.label)
                                        ),
                                        h('td', null, h('span', { className: 'text-xs' }, r.template_name)),
                                        h('td', null, 
                                            h('div', { className: 'flex gap-1' },
                                                h('span', { className: 'text-emerald-400 font-bold' }, r.pass_count || 0),
                                                h('span', { className: 'text-surface-600' }, '/'),
                                                h('span', { className: 'text-red-400 font-bold' }, r.fail_count || 0),
                                                h('span', { className: 'text-surface-600' }, '/'),
                                                h('span', { className: 'text-surface-400 font-bold' }, r.na_count || 0)
                                            )
                                        ),
                                        h('td', null, h('span', { className: 'text-xs' }, r.performed_by)),
                                        h('td', null, 
                                            h('span', { className: 'badge badge-success' }, 'เสร็จสิ้น')
                                        )
                                    );
                                })
                    )
                )
            )
        )
    );
}

window.PMHistoryPage = PMHistoryPage;
