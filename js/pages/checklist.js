// ==========================================
// PM CHECKLIST PAGE - User Checklist Execution
// ==========================================

function ChecklistPage({ user, showToast, setCurrentPage, selectedMold, clearSelectedMold }) {
    const h = React.createElement;
    const [view, setView] = React.useState('category'); // category | level | fill | manage
    const [categories, setCategories] = React.useState([]);
    const [templates, setTemplates] = React.useState([]);
    const [molds, setMolds] = React.useState([]);
    const [selectedCategory, setSelectedCategory] = React.useState(null);
    const [selectedTemplate, setSelectedTemplate] = React.useState(null);
    const [checklistData, setChecklistData] = React.useState({});
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
                // Load categories
                const { data: catData, error: catErr } = await window.supabaseClient
                    .from('pm_categories')
                    .select('*')
                    .order('name');
                if (catErr) throw catErr;
                setCategories(catData || []);

                // Load all active templates
                const { data: tmplData, error: tmplErr } = await window.supabaseClient
                    .from('pm_checklist_templates')
                    .select('*, pm_categories(name)')
                    .eq('is_active', true);
                if (tmplErr) throw tmplErr;
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
                const demoCats = [
                    { id: 'cat-1', name: 'PM Mold Plastic' },
                    { id: 'cat-2', name: 'PM Die Casting' }
                ];
                setCategories(demoCats);
                setTemplates([
                    { id: 'demo-1', template_name: 'Mold Maintenance Level 1', category_id: 'cat-1', pm_level: 1, items: [{ name: 'ตรวจสอบสภาพผิวหน้าแม่พิมพ์', category: 'Visual' }, { name: 'ตรวจสอบระบบหล่อเย็น', category: 'Cooling' }], pm_categories: { name: 'PM Mold Plastic' } },
                ]);
                setMolds([
                    { mold_code: '1700000145', mold_name: 'ELBOW', vendor: 'SPP', dwg_part1: 'AZ25B420' },
                ]);
            }
        } catch (err) {
            console.error('Load data error:', err);
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
                category_name: selectedCategory.name,
                pm_level: selectedTemplate.pm_level,
                mold_code: moldCode.trim(),
                performed_by: user?.display_name || user?.username || 'Unknown',
                performed_date: new Date().toISOString().split('T')[0],
                checklist_data: results,
                notes: notes.trim(),
                status: 'completed',
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

    const getTypeInfo = (level) => (window.CHECKLIST_TYPES || []).find(t => t.id === level) || { label: 'Level ' + level, icon: 'fa-list', color: 'from-gray-500 to-gray-600' };

    if (view === 'manage') {
        return h(window.ChecklistTemplateManager, { showToast, onBack: () => { setView('category'); loadData(); } });
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
                h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setView('level') }, h('i', { className: 'fa-solid fa-arrow-left' })),
                h('div', null,
                    h('p', { className: 'text-xs text-surface-400' }, selectedCategory.name),
                    h('h2', { className: 'text-lg font-semibold text-white' }, selectedTemplate.template_name),
                    h('span', { className: 'badge badge-primary text-xs' }, getTypeInfo(selectedTemplate.pm_level).label)
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

    // ---- CATEGORY SELECTION VIEW ----
    if (view === 'category') {
        return h('div', { className: 'space-y-6 animate-fade-in' },
            h('div', { className: 'flex items-center justify-between' },
                h('div', null,
                    h('h2', { className: 'text-xl font-bold text-white' }, 'PM Checklist'),
                    h('p', { className: 'text-sm text-surface-400' }, 'เลือกหมวดหมู่ที่ต้องการทำ PM')
                ),
                isAdmin && h('button', { className: 'btn btn-secondary', onClick: () => setView('manage') }, h('i', { className: 'fa-solid fa-cog mr-2' }), 'จัดการเทมเพลต')
            ),
            loading ? h('div', { className: 'text-center py-20' }, h('div', { className: 'loading-spinner mx-auto' }))
            : categories.length === 0 
                ? h('div', { className: 'text-center py-20 text-surface-500' }, h('p', null, 'ยังไม่มีหมวดหมู่ PM'))
                : h('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' },
                    categories.map(cat => h('div', {
                        key: cat.id,
                        className: 'card cursor-pointer hover:border-primary-500/30 hover:-translate-y-1 transition-all group p-6',
                        onClick: () => { setSelectedCategory(cat); setView('level'); }
                    },
                        h('div', { className: 'w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors' },
                            h('i', { className: 'fa-solid fa-toolbox text-2xl text-primary-400' })
                        ),
                        h('h3', { className: 'text-lg font-bold text-white mb-1' }, cat.name),
                        h('p', { className: 'text-sm text-surface-500 mb-4' }, cat.description || 'การบำรุงรักษาอุปกรณ์ตามรอบ'),
                        h('div', { className: 'pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-primary-400' },
                            h('span', null, 'เลือกหมวดหมู่นี้'),
                            h('i', { className: 'fa-solid fa-arrow-right' })
                        )
                    ))
                )
        );
    }

    // ---- LEVEL SELECTION VIEW ----
    if (view === 'level') {
        const availableLevels = templates
            .filter(t => t.category_id === selectedCategory?.id)
            .sort((a, b) => a.pm_level - b.pm_level);

        return h('div', { className: 'space-y-6 animate-fade-in' },
            h('div', { className: 'flex items-center gap-3' },
                h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setView('category') }, h('i', { className: 'fa-solid fa-arrow-left' })),
                h('div', null,
                    h('h2', { className: 'text-xl font-bold text-white' }, selectedCategory?.name),
                    h('p', { className: 'text-sm text-surface-400' }, 'เลือกระดับการตรวจสอบ (PM Level)')
                )
            ),
            h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-5' },
                availableLevels.length === 0
                    ? h('div', { className: 'col-span-full text-center py-10 text-surface-500' }, 'ยังไม่มีเทมเพลตสำหรับหมวดหมู่นี้')
                    : availableLevels.map(tmpl => {
                        const typeInfo = getTypeInfo(tmpl.pm_level);
                        return h('div', {
                            key: tmpl.id,
                            className: 'card cursor-pointer hover:border-primary-500/30 hover:-translate-y-1 transition-all group overflow-hidden relative',
                            onClick: () => startChecklist(tmpl)
                        },
                            h('div', { className: 'absolute top-0 right-0 p-3 opacity-10' }, h('i', { className: `fa-solid ${typeInfo.icon} text-4xl` })),
                            h('div', { className: 'flex items-center gap-4 mb-4' },
                                h('div', { className: `w-12 h-12 rounded-xl bg-gradient-to-br ${typeInfo.color} flex items-center justify-center text-white text-xl shadow-lg` }, h('i', { className: `fa-solid ${typeInfo.icon}` })),
                                h('div', null,
                                    h('h3', { className: 'font-bold text-white' }, typeInfo.label),
                                    h('p', { className: 'text-xs text-surface-500' }, tmpl.items.length + ' รายการตรวจ')
                                )
                            ),
                            h('p', { className: 'text-xs text-surface-400 mb-4 min-h-[32px]' }, tmpl.template_name),
                            h('div', { className: 'pt-3 border-t border-white/5 flex items-center justify-between text-xs font-bold text-primary-400' },
                                h('span', null, 'เริ่มทำรายการ'),
                                h('i', { className: 'fa-solid fa-chevron-right' })
                            )
                        );
                    })
            )
        );
    }

    return null;
}

window.ChecklistPage = ChecklistPage;
