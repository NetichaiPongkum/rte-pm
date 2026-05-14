// ==========================================
// INSPECTION MODULE - Template Manager
// ==========================================

const INSPECTION_TYPES = [
    { id: 1,    label: 'Standard', icon: 'fa-microscope', color: 'bg-primary-500/10 text-primary-400' },
    { id: 2,    label: 'Critical', icon: 'fa-shield-halved', color: 'bg-amber-500/10 text-amber-400' },
    { id: 3,    label: 'Full Set', icon: 'fa-list-check', color: 'bg-emerald-500/10 text-emerald-400' },
];

function InspectionTemplateManager({ showToast, onBack }) {
    const h = React.createElement;
    const [categories, setCategories] = React.useState([]);
    const [showCategoryManager, setShowCategoryManager] = React.useState(false);
    const [templates, setTemplates] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [showForm, setShowForm] = React.useState(false);
    const [editingTemplate, setEditingTemplate] = React.useState(null);
    const [formData, setFormData] = React.useState({
        template_name: '',
        category_id: '',
        pm_level: 1,
        items: [{ name: '', category: '' }]
    });

    React.useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                const { data: cats } = await window.supabaseClient.from('inspection_categories').select('*').order('name');
                setCategories(cats || []);

                const { data: tmpls } = await window.supabaseClient.from('inspection_templates').select('*, inspection_categories(name)').eq('is_active', true).order('created_at', { ascending: false });
                setTemplates(tmpls || []);
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ template_name: '', category_id: categories.length > 0 ? categories[0].id : '', pm_level: 1, items: [{ name: '', category: '' }] });
        setEditingTemplate(null);
        setShowForm(false);
    };

    const handleSave = async () => {
        if (!formData.template_name.trim() || !formData.category_id) return showToast('กรุณากรอกข้อมูลให้ครบ', 'warning');
        const validItems = formData.items.filter(it => it.name.trim());
        if (validItems.length === 0) return showToast('กรุณาเพิ่มรายการตรวจสอบ', 'warning');

        try {
            const payload = { template_name: formData.template_name.trim(), category_id: formData.category_id, pm_level: parseInt(formData.pm_level), items: validItems, is_active: true };
            if (window.supabaseClient) {
                if (editingTemplate) await window.supabaseClient.from('inspection_templates').update(payload).eq('id', editingTemplate.id);
                else await window.supabaseClient.from('inspection_templates').insert(payload);
                loadData();
            }
            showToast('บันทึกสำเร็จ', 'success');
            resetForm();
        } catch (err) {
            showToast('บันทึกล้มเหลว', 'error');
        }
    };

    const updateItem = (idx, field, value) => {
        const items = [...formData.items];
        items[idx] = { ...items[idx], [field]: value };
        setFormData({ ...formData, items });
    };

    if (showForm) {
        return h('div', { className: 'space-y-6 animate-fade-in' },
            h('div', { className: 'flex items-center gap-3' },
                h('button', { className: 'btn btn-ghost btn-sm', onClick: resetForm }, h('i', { className: 'fa-solid fa-arrow-left' })),
                h('h2', { className: 'text-lg font-semibold text-white' }, editingTemplate ? 'แก้ไขเทมเพลต Inspection' : 'สร้างเทมเพลต Inspection')
            ),
            h('div', { className: 'card space-y-5 shadow-2xl border-white/5' },
                h('div', null,
                    h('label', { className: 'label' }, 'ชื่อเทมเพลต'),
                    h('input', { className: 'input', value: formData.template_name, onChange: e => setFormData({ ...formData, template_name: e.target.value }) })
                ),
                h('div', { className: 'grid grid-cols-2 gap-4' },
                    h('div', null,
                        h('label', { className: 'label' }, 'หมวดหมู่'),
                        h('select', { className: 'input', value: formData.category_id, onChange: e => setFormData({ ...formData, category_id: e.target.value }) },
                            h('option', { value: '' }, '-- เลือกหมวดหมู่ --'),
                            categories.map(c => h('option', { key: c.id, value: c.id }, c.name))
                        )
                    ),
                    h('div', null,
                        h('label', { className: 'label' }, 'ประเภท (Type)'),
                        h('div', { className: 'flex gap-2' },
                            INSPECTION_TYPES.map(t => h('button', { 
                                key: t.id, 
                                className: `btn btn-sm flex-1 ${formData.pm_level === t.id ? 'btn-primary' : 'btn-ghost'}`,
                                onClick: () => setFormData({ ...formData, pm_level: t.id })
                            }, t.label))
                        )
                    )
                ),
                h('div', { className: 'space-y-2' },
                    h('label', { className: 'label' }, 'รายการตรวจสอบ'),
                    formData.items.map((item, idx) => h('div', { key: idx, className: 'flex gap-2' },
                        h('input', { className: 'input flex-1', placeholder: 'รายการ', value: item.name, onChange: e => updateItem(idx, 'name', e.target.value) }),
                        h('button', { className: 'btn btn-ghost btn-sm text-red-400', onClick: () => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) }) }, h('i', { className: 'fa-solid fa-trash' }))
                    )),
                    h('button', { className: 'btn btn-secondary btn-sm', onClick: () => setFormData({ ...formData, items: [...formData.items, { name: '', category: '' }] }) }, '+ เพิ่มรายการ')
                ),
                h('div', { className: 'flex justify-end gap-3' },
                    h('button', { className: 'btn btn-ghost', onClick: resetForm }, 'ยกเลิก'),
                    h('button', { className: 'btn btn-primary', onClick: handleSave }, 'บันทึก')
                )
            )
        );
    }

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex justify-between items-center' },
            h('div', { className: 'flex items-center gap-3' },
                h('button', { className: 'btn btn-ghost btn-sm', onClick: onBack }, h('i', { className: 'fa-solid fa-arrow-left' })),
                h('h2', { className: 'text-lg font-semibold' }, 'จัดการเทมเพลต Inspection')
            ),
            h('div', { className: 'flex gap-2' },
                h('button', { className: 'btn btn-secondary btn-sm', onClick: () => setShowCategoryManager(true) }, 'จัดการหมวดหมู่'),
                h('button', { className: 'btn btn-primary btn-sm', onClick: () => setShowForm(true) }, '+ สร้างใหม่')
            )
        ),
        showCategoryManager && h(InspectionCategoryManager, { categories, onClose: () => { setShowCategoryManager(false); loadData(); }, showToast }),
        h('div', { className: 'grid gap-4' },
            templates.map(t => h('div', { key: t.id, className: 'card flex justify-between items-center' },
                h('div', null,
                    h('h4', { className: 'font-bold' }, t.template_name),
                    h('p', { className: 'text-xs text-surface-400' }, `${t.inspection_categories?.name || '-'} | ${t.items?.length || 0} รายการ`)
                ),
                h('div', { className: 'flex gap-2' },
                    h('button', { className: 'btn btn-ghost btn-xs text-primary-400', onClick: () => { setEditingTemplate(t); setFormData({ ...t }); setShowForm(true); } }, h('i', { className: 'fa-solid fa-pen' })),
                    h('button', { className: 'btn btn-ghost btn-xs text-red-400', onClick: async () => { if(confirm('ลบ?')) { await window.supabaseClient.from('inspection_templates').update({is_active:false}).eq('id',t.id); loadData(); } } }, h('i', { className: 'fa-solid fa-trash' }))
                )
            ))
        )
    );
}

function InspectionCategoryManager({ categories, onClose, showToast }) {
    const h = React.createElement;
    const [name, setName] = React.useState('');
    return h('div', { className: 'fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm' },
        h('div', { className: 'card w-full max-w-md' },
            h('div', { className: 'flex justify-between p-4 border-b border-white/5' }, h('h4', null, 'หมวดหมู่ Inspection'), h('button', { onClick: onClose }, 'X')),
            h('div', { className: 'p-4 space-y-4' },
                h('div', { className: 'flex gap-2' },
                    h('input', { className: 'input', value: name, onChange: e => setName(e.target.value) }),
                    h('button', { className: 'btn btn-primary', onClick: async () => { await window.supabaseClient.from('inspection_categories').insert({name}); setName(''); onClose(); } }, 'เพิ่ม')
                ),
                h('div', { className: 'space-y-2' },
                    categories.map(c => h('div', { key: c.id, className: 'flex justify-between text-sm' }, h('span', null, c.name), h('button', { className: 'text-red-400', onClick: async () => { await window.supabaseClient.from('inspection_categories').delete().eq('id',c.id); onClose(); } }, 'ลบ')))
                )
            )
        )
    );
}

window.InspectionTemplateManager = InspectionTemplateManager;
