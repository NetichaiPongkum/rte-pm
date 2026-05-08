// ==========================================
// PM CHECKLIST PAGE - Part 1: Admin Template Manager
// ==========================================

const CHECKLIST_TYPES = [
    { id: 1,    label: 'Level 1',    icon: 'fa-1',  color: 'from-blue-500 to-cyan-500' },
    { id: 2,    label: 'Level 2',    icon: 'fa-2',  color: 'from-amber-500 to-orange-500' },
    { id: 3,    label: 'Level 3',    icon: 'fa-3',  color: 'from-emerald-500 to-green-500' },
];

// ==========================================
// CHECKLIST TEMPLATE MANAGER (Admin Only)
// ==========================================
function ChecklistTemplateManager({ showToast, onBack }) {
    const h = React.createElement;
    const [categories, setCategories] = React.useState([]);
    const [showCategoryManager, setShowCategoryManager] = React.useState(false);
    const [formData, setFormData] = React.useState({
        template_name: '',
        category_id: '',
        pm_level: 1,
        items: [{ name: '', category: '' }]
    });

    // Load initial data
    React.useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                // Load Categories
                const { data: cats, error: catErr } = await window.supabaseClient
                    .from('pm_categories')
                    .select('*')
                    .order('name');
                if (catErr) throw catErr;
                setCategories(cats || []);

                // Load Templates
                const { data: tmpls, error: tmplErr } = await window.supabaseClient
                    .from('pm_checklist_templates')
                    .select('*, pm_categories(name)')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                if (tmplErr) throw tmplErr;
                setTemplates(tmpls || []);
            } else {
                // Demo data
                setCategories([
                    { id: 'cat-1', name: 'PM Mold Plastic' },
                    { id: 'cat-2', name: 'PM Die Casting' }
                ]);
                setTemplates([
                    { id: 'demo-1', template_name: 'Mold Maintenance Level 1', category_id: 'cat-1', pm_level: 1, items: [
                        { name: 'ตรวจสอบสภาพผิวหน้าแม่พิมพ์', category: 'Visual' },
                        { name: 'ตรวจสอบระบบหล่อเย็น', category: 'Cooling' },
                    ], pm_categories: { name: 'PM Mold Plastic' } },
                ]);
            }
        } catch (err) {
            console.error('Load data error:', err);
            showToast('โหลดข้อมูลล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ 
            template_name: '', 
            category_id: categories.length > 0 ? categories[0].id : '', 
            pm_level: 1, 
            items: [{ name: '', category: '' }] 
        });
        setEditingTemplate(null);
        setShowForm(false);
    };

    const handleEdit = (tmpl) => {
        setEditingTemplate(tmpl);
        setFormData({
            template_name: tmpl.template_name,
            category_id: tmpl.category_id || (categories.length > 0 ? categories[0].id : ''),
            pm_level: tmpl.pm_level || 1,
            items: Array.isArray(tmpl.items) ? [...tmpl.items] : [{ name: '', category: '' }]
        });
        setShowForm(true);
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { name: '', category: '' }]
        }));
    };

    const removeItem = (idx) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== idx)
        }));
    };

    const updateItem = (idx, field, value) => {
        setFormData(prev => {
            const items = [...prev.items];
            items[idx] = { ...items[idx], [field]: value };
            return { ...prev, items };
        });
    };

    const handleSave = async () => {
        if (!formData.template_name.trim()) {
            showToast('กรุณากรอกชื่อเทมเพลต', 'warning');
            return;
        }
        if (!formData.category_id) {
            showToast('กรุณาเลือกหมวดหมู่', 'warning');
            return;
        }
        const validItems = formData.items.filter(it => it.name.trim());
        if (validItems.length === 0) {
            showToast('กรุณาเพิ่มรายการตรวจอย่างน้อย 1 รายการ', 'warning');
            return;
        }

        try {
            const payload = {
                template_name: formData.template_name.trim(),
                category_id: formData.category_id,
                pm_level: parseInt(formData.pm_level),
                items: validItems,
                is_active: true,
            };

            if (window.supabaseClient) {
                if (editingTemplate && editingTemplate.id && !editingTemplate.id.startsWith('demo')) {
                    await window.supabaseClient.from('pm_checklist_templates')
                        .update(payload).eq('id', editingTemplate.id);
                } else {
                    await window.supabaseClient.from('pm_checklist_templates')
                        .insert(payload);
                }
            } else {
                // Demo mode - add locally
                const newTmpl = { ...payload, id: 'demo-' + Date.now(), pm_categories: { name: categories.find(c => c.id === payload.category_id)?.name || 'Unknown' } };
                setTemplates(prev => [newTmpl, ...prev]);
            }

            showToast(editingTemplate ? 'อัปเดตเทมเพลตสำเร็จ' : 'สร้างเทมเพลตสำเร็จ', 'success');
            resetForm();
            if (window.supabaseClient) loadData();
        } catch (err) {
            console.error('Save template error:', err);
            showToast('บันทึกล้มเหลว', 'error');
        }
    };

    const handleDelete = async (tmpl) => {
        if (!confirm('ต้องการลบเทมเพลตนี้หรือไม่?')) return;
        try {
            if (window.supabaseClient && !tmpl.id.startsWith('demo')) {
                await window.supabaseClient.from('pm_checklist_templates')
                    .update({ is_active: false }).eq('id', tmpl.id);
            }
            setTemplates(prev => prev.filter(t => t.id !== tmpl.id));
            showToast('ลบเทมเพลตสำเร็จ', 'success');
        } catch (err) {
            showToast('ลบล้มเหลว', 'error');
        }
    };

    const getTypeInfo = (level) => CHECKLIST_TYPES.find(t => t.id === level) || CHECKLIST_TYPES[0];

    // ---- RENDER ----
    if (showForm) {
        return h('div', { className: 'space-y-6 animate-fade-in' },
            // Header
            h('div', { className: 'flex items-center gap-3' },
                h('button', { className: 'btn btn-ghost btn-sm', onClick: resetForm },
                    h('i', { className: 'fa-solid fa-arrow-left' })
                ),
                h('h2', { className: 'text-lg font-semibold' }, editingTemplate ? 'แก้ไขเทมเพลต' : 'สร้างเทมเพลตใหม่')
            ),

            // Form Card
            h('div', { className: 'card space-y-5' },
                // Template Name
                h('div', null,
                    h('label', { className: 'block text-sm font-medium text-surface-300 mb-1.5' }, 'ชื่อเทมเพลต'),
                    h('input', {
                        className: 'input',
                        placeholder: 'เช่น Mold Maintenance Type 1',
                        value: formData.template_name,
                        onChange: e => setFormData(p => ({ ...p, template_name: e.target.value }))
                    })
                ),

                // Category & Level Selectors
                h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    h('div', null,
                        h('label', { className: 'block text-sm font-medium text-surface-300 mb-1.5' }, 'หมวดหมู่'),
                        h('select', {
                            className: 'input',
                            value: formData.category_id,
                            onChange: e => setFormData(p => ({ ...p, category_id: e.target.value }))
                        },
                            categories.map(cat => h('option', { key: cat.id, value: cat.id }, cat.name))
                        )
                    ),
                    h('div', null,
                        h('label', { className: 'block text-sm font-medium text-surface-300 mb-1.5' }, 'ระดับ (Level)'),
                        h('div', { className: 'grid grid-cols-3 gap-3' },
                            CHECKLIST_TYPES.map(type =>
                                h('div', {
                                    key: type.id,
                                    className: `p-3 rounded-xl border cursor-pointer transition-all text-center ${
                                        formData.pm_level === type.id
                                            ? 'border-primary-500 bg-primary-500/10'
                                            : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                                    }`,
                                    onClick: () => setFormData(p => ({ ...p, pm_level: type.id }))
                                },
                                    h('i', { className: `fa-solid ${type.icon} text-lg mb-1 ${formData.pm_level === type.id ? 'text-primary-400' : 'text-surface-500'}` }),
                                    h('p', { className: `text-xs font-medium ${formData.pm_level === type.id ? 'text-primary-300' : 'text-surface-400'}` }, type.label)
                                )
                            )
                        )
                    )
                ),

                // Checklist Items
                h('div', null,
                    h('div', { className: 'flex items-center justify-between mb-2' },
                        h('label', { className: 'text-sm font-medium text-surface-300' }, 'รายการตรวจสอบ'),
                        h('span', { className: 'badge badge-primary' }, formData.items.length + ' รายการ')
                    ),
                    h('div', { className: 'space-y-2' },
                        formData.items.map((item, idx) =>
                            h('div', { key: idx, className: 'flex gap-2 items-start animate-fade-in' },
                                h('span', { className: 'text-xs text-surface-600 mt-2.5 w-6 text-right flex-shrink-0' }, (idx + 1) + '.'),
                                h('input', {
                                    className: 'input flex-1',
                                    placeholder: 'รายการตรวจสอบ',
                                    value: item.name,
                                    onChange: e => updateItem(idx, 'name', e.target.value)
                                }),
                                h('input', {
                                    className: 'input w-32',
                                    placeholder: 'หมวดหมู่',
                                    value: item.category,
                                    onChange: e => updateItem(idx, 'category', e.target.value)
                                }),
                                formData.items.length > 1 && h('button', {
                                    className: 'btn btn-ghost btn-sm text-red-400 hover:text-red-300 mt-0.5 flex-shrink-0',
                                    onClick: () => removeItem(idx)
                                }, h('i', { className: 'fa-solid fa-trash-can' }))
                            )
                        )
                    ),
                    h('button', { className: 'btn btn-secondary btn-sm mt-3', onClick: addItem },
                        h('i', { className: 'fa-solid fa-plus mr-1' }), 'เพิ่มรายการ'
                    )
                ),

                // Save / Cancel
                h('div', { className: 'flex justify-end gap-3 pt-4 border-t border-white/5' },
                    h('button', { className: 'btn btn-secondary', onClick: resetForm }, 'ยกเลิก'),
                    h('button', { className: 'btn btn-primary', onClick: handleSave },
                        h('i', { className: 'fa-solid fa-save mr-1' }),
                        editingTemplate ? 'อัปเดต' : 'บันทึก'
                    )
                )
            )
        );
    }

    // ---- TEMPLATE LIST VIEW ----
    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between' },
            h('div', { className: 'flex items-center gap-3' },
                h('button', { className: 'btn btn-ghost btn-sm', onClick: onBack },
                    h('i', { className: 'fa-solid fa-arrow-left' })
                ),
                h('h2', { className: 'text-lg font-semibold' }, 'จัดการเทมเพลตเช็คลิส')
            ),
            h('div', { className: 'flex gap-2' },
                h('button', { className: 'btn btn-secondary', onClick: () => setShowCategoryManager(true) },
                    h('i', { className: 'fa-solid fa-tags mr-1' }), 'จัดการหมวดหมู่'
                ),
                h('button', { className: 'btn btn-primary', onClick: () => setShowForm(true) },
                    h('i', { className: 'fa-solid fa-plus mr-1' }), 'สร้างใหม่'
                )
            )
        ),

        // Category Manager Overlay
        showCategoryManager && h(CategoryManager, { 
            categories, 
            onClose: () => { setShowCategoryManager(false); loadData(); }, 
            showToast 
        }),

        loading
            ? h('div', { className: 'flex justify-center py-20' }, h('div', { className: 'loading-spinner' }))
            : templates.length === 0
                ? h('div', { className: 'text-center py-20 text-surface-500' },
                    h('i', { className: 'fa-solid fa-clipboard-list text-4xl mb-4 block' }),
                    h('p', null, 'ยังไม่มีเทมเพลตเช็คลิส'),
                    h('button', { className: 'btn btn-primary mt-4', onClick: () => setShowForm(true) },
                        h('i', { className: 'fa-solid fa-plus mr-1' }), 'สร้างเทมเพลตแรก'
                    )
                )
                : h('div', { className: 'grid gap-4' },
                    templates.map((tmpl, i) => {
                        const typeInfo = getTypeInfo(tmpl.checklist_type);
                        const items = Array.isArray(tmpl.items) ? tmpl.items : [];
                        return h('div', { key: tmpl.id, className: 'card group hover:scale-[1.005] animate-slide-up', style: { animationDelay: (i * 50) + 'ms' } },
                            h('div', { className: 'flex items-start justify-between' },
                                h('div', { className: 'flex items-center gap-4' },
                                    h('div', { className: `w-12 h-12 rounded-xl bg-gradient-to-br ${typeInfo.color} flex items-center justify-center flex-shrink-0` },
                                        h('i', { className: `fa-solid ${typeInfo.icon} text-white text-lg` })
                                    ),
                                    h('div', null,
                                        h('h3', { className: 'font-semibold text-white' }, tmpl.template_name),
                                        h('div', { className: 'flex items-center gap-3 mt-1' },
                                            h('span', { className: 'badge badge-primary' }, tmpl.pm_categories?.name || 'ไม่ระบุหมวดหมู่'),
                                            h('span', { className: 'badge badge-secondary' }, typeInfo.label),
                                            h('span', { className: 'text-xs text-surface-500' }, items.length + ' รายการ')
                                        )
                                    )
                                ),
                                h('div', { className: 'flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity' },
                                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => handleEdit(tmpl), title: 'แก้ไข' },
                                        h('i', { className: 'fa-solid fa-pen text-primary-400' })
                                    ),
                                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => handleDelete(tmpl), title: 'ลบ' },
                                        h('i', { className: 'fa-solid fa-trash-can text-red-400' })
                                    )
                                )
                            ),
                            items.length > 0 && h('div', { className: 'mt-4 pt-3 border-t border-white/5' },
                                h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-1' },
                                    items.slice(0, 6).map((item, j) =>
                                        h('div', { key: j, className: 'text-xs text-surface-400 flex items-center gap-2 py-1' },
                                            h('i', { className: 'fa-solid fa-circle text-[4px] text-surface-600' }),
                                            h('span', null, item.name),
                                            item.category && h('span', { className: 'text-surface-600 ml-auto' }, item.category)
                                        )
                                    ),
                                    items.length > 6 && h('div', { className: 'text-xs text-surface-600 py-1' }, '... อีก ' + (items.length - 6) + ' รายการ')
                                )
                            )
                        );
                    })
                )
    );
}

// ==========================================
// CATEGORY MANAGER COMPONENT
// ==========================================
function CategoryManager({ categories, onClose, showToast }) {
    const h = React.createElement;
    const [loading, setLoading] = React.useState(false);
    const [newCatName, setNewCatName] = React.useState('');

    const handleAdd = async () => {
        if (!newCatName.trim()) return;
        setLoading(true);
        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient
                    .from('pm_categories')
                    .insert({ name: newCatName.trim() });
                if (error) throw error;
            }
            showToast('เพิ่มหมวดหมู่สำเร็จ', 'success');
            setNewCatName('');
            onClose(); // Trigger reload
        } catch (err) {
            showToast('เพิ่มหมวดหมู่ล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('ต้องการลบหมวดหมู่นี้หรือไม่?')) return;
        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient
                    .from('pm_categories')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            }
            showToast('ลบหมวดหมู่สำเร็จ', 'success');
            onClose(); // Trigger reload
        } catch (err) {
            showToast('ลบล้มเหลว (อาจมีข้อมูลที่เชื่อมโยงอยู่)', 'error');
        }
    };

    return h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm animate-fade-in' },
        h('div', { className: 'card-glass w-full max-w-md p-6' },
            h('div', { className: 'flex items-center justify-between mb-6' },
                h('h3', { className: 'text-lg font-bold text-white' }, 'จัดการหมวดหมู่ PM'),
                h('button', { className: 'text-surface-500 hover:text-white', onClick: onClose }, h('i', { className: 'fa-solid fa-xmark text-xl' }))
            ),

            h('div', { className: 'flex gap-2 mb-6' },
                h('input', {
                    className: 'input',
                    placeholder: 'ชื่อหมวดหมู่ใหม่...',
                    value: newCatName,
                    onChange: e => setNewCatName(e.target.value)
                }),
                h('button', { className: 'btn btn-primary px-4', onClick: handleAdd, disabled: loading }, 'เพิ่ม')
            ),

            h('div', { className: 'space-y-2 max-h-[40vh] overflow-y-auto pr-2' },
                categories.map(cat =>
                    h('div', { key: cat.id, className: 'flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5' },
                        h('span', { className: 'text-sm text-surface-200' }, cat.name),
                        h('button', { 
                            className: 'text-red-400 hover:text-red-300 p-1', 
                            onClick: () => handleDelete(cat.id) 
                        }, h('i', { className: 'fa-solid fa-trash-can text-xs' }))
                    )
                )
            ),

            h('div', { className: 'mt-6 pt-4 border-t border-white/5 text-right' },
                h('button', { className: 'btn btn-secondary', onClick: onClose }, 'ปิด')
            )
        )
    );
}

window.ChecklistTemplateManager = ChecklistTemplateManager;
window.CHECKLIST_TYPES = CHECKLIST_TYPES;
