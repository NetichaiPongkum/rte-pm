// ==========================================
// PM CHECKLIST PAGE - User Checklist Execution
// ==========================================

function ChecklistPage({ user, showToast, setCurrentPage, selectedMold, clearSelectedMold }) {
    const h = React.createElement;
    const [view, setView] = React.useState('select'); // select | fill | manage
    const [templates, setTemplates] = React.useState([]);
    const [molds, setMolds] = React.useState([]);
    const [selectedTemplate, setSelectedTemplate] = React.useState(null);
    const [checklistData, setChecklistData] = React.useState({});
    const [filterType, setFilterType] = React.useState('all');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Form state
    const [moldCode, setMoldCode] = React.useState('');
    const [moldInfo, setMoldInfo] = React.useState({ name: '', vendor: '', dwg: '' });
    const [notes, setNotes] = React.useState('');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [showMoldResults, setShowMoldResults] = React.useState(false);

    const isAdmin = user && user.role === 'admin';
    const vendorAccess = user?.vendor_access || 'ALL';

    React.useEffect(() => {
        loadData();
    }, [vendorAccess]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                // Load templates
                const { data: tmplData } = await window.supabaseClient
                    .from('pm_checklist_templates')
                    .select('*')
                    .eq('is_active', true)
                    .order('checklist_type');
                setTemplates(tmplData || []);

                // Load molds for auto-search
                let query = window.supabaseClient.from('mold_master').select('mold_code, mold_name, vendor, dwg_part1');
                if (vendorAccess !== 'ALL') {
                    query = query.eq('vendor', vendorAccess);
                }
                const { data: moldData } = await query;
                setMolds(moldData || []);
            } else {
                // Demo data
                setTemplates([
                    { id: 'demo-1', template_name: 'Mold Maintenance Type 1', checklist_type: 'type1', items: [{ name: 'ตรวจสอบสภาพผิวหน้าแม่พิมพ์', category: 'Visual' }, { name: 'ตรวจสอบระบบหล่อเย็น', category: 'Cooling' }] },
                ]);
                setMolds([
                    { mold_code: '1700000145', mold_name: 'ELBOW', vendor: 'SPP', dwg_part1: 'AZ25B420' },
                ]);
            }
        } catch (err) {
            showToast('โหลดข้อมูลล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectMold = (mold) => {
        setMoldCode(mold.mold_code);
        setMoldInfo({ name: mold.mold_name, vendor: mold.vendor, dwg: mold.dwg_part1 });
        setSearchQuery(mold.mold_code);
        setShowMoldResults(false);
    };

    const startChecklist = (tmpl) => {
        setSelectedTemplate(tmpl);
        const initial = {};
        (tmpl.items || []).forEach((_, i) => { initial[i] = null; });
        setChecklistData(initial);
        setNotes('');
        setView('fill');
    };

    const handleSaveRecord = async () => {
        const items = selectedTemplate?.items || [];
        const filled = Object.values(checklistData).filter(v => v !== null).length;
        if (filled < items.length) {
            showToast(`ยังเหลืออีก ${items.length - filled} รายการที่ยังไม่ได้เช็ค`, 'warning');
            return;
        }
        if (!moldCode.trim()) {
            showToast('กรุณาเลือกรหัสแม่พิมพ์', 'warning');
            return;
        }

        setSaving(true);
        try {
            const results = items.map((item, i) => ({
                name: item.name,
                category: item.category,
                result: checklistData[i],
            }));

            const record = {
                template_id: selectedTemplate.id,
                template_name: selectedTemplate.template_name,
                checklist_type: selectedTemplate.checklist_type,
                mold_code: moldCode.trim(),
                performed_by: user?.display_name || user?.username || 'Unknown',
                performed_date: new Date().toISOString().split('T')[0],
                checklist_data: results,
                notes: notes.trim(),
                status: 'completed',
                pass_count: results.filter(r => r.result === 'pass').length,
                fail_count: results.filter(r => r.result === 'fail').length,
                na_count: results.filter(r => r.result === 'na').length,
            };

            if (window.supabaseClient) {
                const { error } = await window.supabaseClient.from('pm_checklist_records').insert(record);
                if (error) throw error;
            } else {
                const demoRecords = JSON.parse(localStorage.getItem('demo_pm_records') || '[]');
                demoRecords.unshift({ ...record, id: 'demo-' + Date.now(), created_at: new Date().toISOString() });
                localStorage.setItem('demo_pm_records', JSON.stringify(demoRecords));
            }

            showToast('บันทึกผลตรวจสอบสำเร็จ', 'success');
            if (clearSelectedMold) clearSelectedMold();
            setCurrentPage('pm-history');
        } catch (err) {
            showToast('บันทึกล้มเหลว', 'error');
        } finally {
            setSaving(false);
        }
    };

    const getTypeInfo = (id) => (window.CHECKLIST_TYPES || []).find(t => t.id === id) || { label: id, icon: 'fa-list', color: 'from-gray-500 to-gray-600' };

    if (view === 'manage') {
        return h(window.ChecklistTemplateManager, { showToast, onBack: () => { setView('select'); loadData(); } });
    }

    if (view === 'fill' && selectedTemplate) {
        const items = selectedTemplate.items || [];
        const filled = Object.values(checklistData).filter(v => v !== null).length;
        const percent = items.length ? Math.round((filled / items.length) * 100) : 0;
        
        const moldResults = searchQuery.length > 0 
            ? molds.filter(m => 
                m.mold_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (m.mold_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.dwg_part1 || '').toLowerCase().includes(searchQuery.toLowerCase())
            ).slice(0, 5)
            : [];

        return h('div', { className: 'space-y-5 animate-fade-in max-w-4xl mx-auto' },
            h('div', { className: 'flex items-center gap-3' },
                h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setView('select') }, h('i', { className: 'fa-solid fa-arrow-left' })),
                h('div', null,
                    h('h2', { className: 'text-lg font-semibold text-white' }, selectedTemplate.template_name),
                    h('span', { className: 'badge badge-primary text-xs' }, getTypeInfo(selectedTemplate.checklist_type).label)
                )
            ),

            // MOLD SEARCH & INFO
            h('div', { className: 'card space-y-4 shadow-xl' },
                h('div', { className: 'relative' },
                    h('label', { className: 'block text-xs font-medium text-surface-400 mb-1.5' }, 'ค้นหาแม่พิมพ์ (ASSET1, Name, DWG) *'),
                    h('div', { className: 'relative' },
                        h('input', {
                            className: 'input pl-10 h-11',
                            placeholder: 'พิมพ์รหัส Asset1 หรือชื่อแม่พิมพ์...',
                            value: searchQuery,
                            onChange: e => { setSearchQuery(e.target.value); setShowMoldResults(true); if(!e.target.value) setMoldCode(''); },
                            onFocus: () => setShowMoldResults(true)
                        }),
                        h('i', { className: 'fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-500' })
                    ),
                    // Dropdown Results
                    showMoldResults && moldResults.length > 0 && h('div', { className: 'absolute z-50 left-0 right-0 mt-1 card-glass p-1 shadow-2xl border border-white/10 max-h-60 overflow-y-auto' },
                        moldResults.map(m => h('div', {
                            key: m.mold_code,
                            className: 'p-3 rounded-lg hover:bg-primary-500/20 cursor-pointer flex justify-between items-center transition-colors',
                            onClick: () => selectMold(m)
                        },
                            h('div', null,
                                h('p', { className: 'text-sm font-bold text-white' }, m.mold_code),
                                h('p', { className: 'text-xs text-surface-400' }, `${m.mold_name} [${m.dwg_part1 || '-'}]`)
                            ),
                            h('span', { className: 'text-[10px] text-primary-500 font-bold bg-primary-500/10 px-2 py-0.5 rounded' }, m.vendor)
                        ))
                    )
                ),
                moldCode && h('div', { className: 'p-4 rounded-xl bg-primary-500/5 border border-primary-500/20 grid grid-cols-3 gap-4 animate-fade-in' },
                    h('div', null, h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold' }, 'Name'), h('p', { className: 'text-sm font-medium text-white truncate' }, moldInfo.name || '-')),
                    h('div', null, h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold' }, 'DWG. Part 1'), h('p', { className: 'text-sm font-medium text-white truncate' }, moldInfo.dwg || '-')),
                    h('div', null, h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold' }, 'Vendor'), h('p', { className: 'text-sm font-medium text-primary-400' }, moldInfo.vendor || '-'))
                )
            ),

            // PROGRESS
            h('div', { className: 'card' },
                h('div', { className: 'flex items-center justify-between mb-2' },
                    h('span', { className: 'text-sm text-surface-300' }, 'ความคืบหน้า'),
                    h('span', { className: 'text-sm font-semibold text-primary-400' }, filled + '/' + items.length + ' (' + percent + '%)')
                ),
                h('div', { className: 'h-2.5 rounded-full bg-white/5 overflow-hidden' },
                    h('div', { className: 'h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500', style: { width: percent + '%' } })
                )
            ),

            // CHECKLIST ITEMS
            ...items.map((item, idx) => h('div', { key: idx, className: 'card flex items-center justify-between hover:bg-white/[0.02] transition-colors' },
                h('div', { className: 'flex-1 pr-4' },
                    h('p', { className: 'text-[10px] text-primary-500 font-bold uppercase mb-0.5' }, item.category || 'ทั่วไป'),
                    h('p', { className: 'text-sm text-white' }, (idx + 1) + '. ' + item.name)
                ),
                h('div', { className: 'flex gap-1.5' },
                    ['pass', 'fail', 'na'].map(res => h('button', {
                        key: res,
                        className: `btn btn-sm px-4 h-9 ${checklistData[idx] === res ? (res === 'pass' ? 'bg-emerald-600 text-white shadow-lg' : res === 'fail' ? 'bg-red-600 text-white shadow-lg' : 'bg-surface-600 text-white shadow-lg') : 'bg-white/5 text-surface-400'}`,
                        onClick: () => setChecklistData(prev => ({ ...prev, [idx]: prev[idx] === res ? null : res }))
                    }, res.toUpperCase()))
                )
            )),

            h('div', { className: 'card' },
                h('label', { className: 'block text-sm font-medium text-surface-300 mb-2' }, 'หมายเหตุเพิ่มเติม'),
                h('textarea', { className: 'input min-h-[100px]', value: notes, onChange: e => setNotes(e.target.value), placeholder: 'ระบุรายละเอียด...' })
            ),

            h('div', { className: 'flex justify-end gap-3 pb-12' },
                h('button', { className: 'btn btn-secondary', onClick: () => setView('select') }, 'ยกเลิก'),
                h('button', { className: 'btn btn-primary btn-lg shadow-xl shadow-primary-500/20', onClick: handleSaveRecord, disabled: saving || !moldCode },
                    saving ? h('div', { className: 'loading-spinner-sm' }) : 'บันทึกผลตรวจสอบ'
                )
            )
        );
    }

    const filtered = templates.filter(t => filterType === 'all' || t.checklist_type === filterType);

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
            h('div', null,
                h('h2', { className: 'text-xl font-bold text-white' }, 'PM Checklist'),
                h('p', { className: 'text-sm text-surface-400' }, 'เลือกเทมเพลตเพื่อเริ่มบันทึกผลตรวจสอบ')
            ),
            isAdmin && h('button', { className: 'btn btn-secondary', onClick: () => setView('manage') }, h('i', { className: 'fa-solid fa-cog mr-2' }), 'จัดการเทมเพลต')
        ),
        h('div', { className: 'flex gap-2 overflow-x-auto pb-3' },
            h('button', { className: `btn btn-sm px-4 ${filterType === 'all' ? 'btn-primary' : 'btn-ghost' }`, onClick: () => setFilterType('all') }, 'ทั้งหมด'),
            ...(window.CHECKLIST_TYPES || []).map(type =>
                h('button', { key: type.id, className: `btn btn-sm px-4 ${filterType === type.id ? 'btn-primary' : 'btn-ghost' }`, onClick: () => setFilterType(type.id) }, type.label)
            )
        ),
        loading ? h('div', { className: 'text-center py-20' }, h('div', { className: 'loading-spinner mx-auto' }))
        : h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' },
            filtered.map(tmpl => h('div', { key: tmpl.id, className: 'card cursor-pointer hover:border-primary-500/30 hover:-translate-y-1 transition-all group overflow-hidden relative', onClick: () => startChecklist(tmpl) },
                h('div', { className: 'absolute top-0 right-0 p-3 opacity-10' }, h('i', { className: `fa-solid ${getTypeInfo(tmpl.checklist_type).icon} text-4xl` })),
                h('div', { className: 'flex items-center gap-4 mb-4' },
                    h('div', { className: `w-12 h-12 rounded-xl bg-gradient-to-br ${getTypeInfo(tmpl.checklist_type).color} flex items-center justify-center text-white text-xl shadow-lg` }, h('i', { className: `fa-solid ${getTypeInfo(tmpl.checklist_type).icon}` })),
                    h('div', null, h('h3', { className: 'font-bold text-white' }, tmpl.template_name), h('p', { className: 'text-xs text-surface-500' }, tmpl.items.length + ' รายการตรวจ'))
                ),
                h('div', { className: 'pt-3 border-t border-white/5 flex items-center justify-between' }, 
                    h('span', { className: 'text-xs text-primary-400 font-bold' }, 'เริ่มทำรายการ'), 
                    h('i', { className: 'fa-solid fa-chevron-right text-[10px] text-surface-600 group-hover:translate-x-1 transition-transform' })
                )
            ))
        )
    );
}

window.ChecklistPage = ChecklistPage;
