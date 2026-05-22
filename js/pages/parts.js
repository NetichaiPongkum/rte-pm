// ==========================================
// PARTS / MOLD MASTER PAGE - CRUD & Import
// ==========================================

function PartsPage({ user, showToast }) {
    const h = React.createElement;
    const [molds, setMolds] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [showModal, setShowModal] = React.useState(false);
    const [editingId, setEditingId] = React.useState(null);
    const [importing, setImporting] = React.useState(false);
    
    const [formData, setFormData] = React.useState({
        mold_code: '',
        mold_name: '',
        dwg_part1: '',
        part_name: '',
        vendor: '',
        machine_no: '',
        cavity: '',
        mold_type: '2-plate'
    });

    const isAdmin = user && user.role === 'admin';
    const vendorAccess = user?.vendor_access || 'ALL';

    React.useEffect(() => {
        loadMolds();
    }, [vendorAccess]);

    const loadMolds = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                let query = window.supabaseClient.from('mold_master').select('*');
                
                // Filter by vendor if not ALL
                if (vendorAccess !== 'ALL') {
                    const vendors = vendorAccess.split(',').map(v => v.trim()).filter(v => v);
                    query = query.in('vendor', vendors);
                }
                
                const { data, error } = await query.order('mold_code').limit(50);
                if (error) throw error;
                setMolds(data || []);
            } else {
                let list = JSON.parse(localStorage.getItem('demo_molds') || '[]');
                if (vendorAccess !== 'ALL') {
                    const vendors = vendorAccess.split(',').map(v => v.trim()).filter(v => v);
                    list = list.filter(m => vendors.includes(m.vendor));
                }
                setMolds(list);
            }
        } catch (err) {
            showToast('โหลดข้อมูลแม่พิมพ์ล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMold = async () => {
        if (!formData.mold_code.trim()) return showToast('กรุณากรอก Asset Mold', 'warning');
        
        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient.from('mold_master').upsert(formData);
                if (error) throw error;
            } else {
                const list = JSON.parse(localStorage.getItem('demo_molds') || '[]');
                if (editingId) {
                    const idx = list.findIndex(m => m.id === editingId);
                    list[idx] = { ...formData, id: editingId };
                } else {
                    list.push({ ...formData, id: 'demo-' + Date.now() });
                }
                localStorage.setItem('demo_molds', JSON.stringify(list));
            }
            showToast('บันทึกข้อมูลแม่พิมพ์สำเร็จ', 'success');
            closeModal();
            loadMolds();
        } catch (err) {
            showToast('บันทึกล้มเหลว', 'error');
        }
    };

    const deleteMold = async (id) => {
        if (!confirm('ยืนยันการลบข้อมูลแม่พิมพ์นี้?')) return;
        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient.from('mold_master').delete().eq('id', id);
                if (error) throw error;
            } else {
                let list = JSON.parse(localStorage.getItem('demo_molds') || '[]');
                list = list.filter(m => m.id !== id);
                localStorage.setItem('demo_molds', JSON.stringify(list));
            }
            showToast('ลบข้อมูลสำเร็จ', 'success');
            loadMolds();
        } catch (err) {
            showToast('ลบล้มเหลว', 'error');
        }
    };

    const handleCSVImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!window.Papa) return showToast('ไม่พบไลบรารี PapaParse', 'error');

        setImporting(true);
        window.Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const data = results.data.map(row => ({
                    mold_code: row['ASSET1'] || row['mold_code'] || row['Asset Mold'],
                    mold_name: row['NAME MOLD'] || row['mold_name'] || row['Name'],
                    dwg_part1: row['DWG PART'] || row['DWG PART 1'] || row['dwg_part1'] || row['DWG.'],
                    part_name: row['PART NAME'] || row['part_name'] || '',
                    vendor: row['VENDOR'] || row['VENDER INJ'] || row['vendor'] || row['Vendor'] || 'SPP',
                    machine_no: row['M/C (TON)'] || row['machine_no'] || '',
                    cavity: parseInt(row['CAV'] || row['cavity'] || '0'),
                    mold_type: row['MOLD TYPE'] || '2-plate'
                })).filter(row => row.mold_code);

                if (data.length === 0) {
                    showToast('ไม่พบข้อมูลในไฟล์ CSV (ตรวจสอบ Header: ASSET1, NAME MOLD, DWG PART 1)', 'warning');
                    setImporting(false);
                    return;
                }

                try {
                    if (window.supabaseClient) {
                        const { error } = await window.supabaseClient.from('mold_master').upsert(data, { onConflict: 'mold_code' });
                        if (error) throw error;
                    } else {
                        const list = JSON.parse(localStorage.getItem('demo_molds') || '[]');
                        const newList = [...list, ...data.map(d => ({ ...d, id: 'csv-' + Math.random() }))];
                        localStorage.setItem('demo_molds', JSON.stringify(newList));
                    }
                    showToast(`นำเข้าสำเร็จ ${data.length} รายการ`, 'success');
                    loadMolds();
                } catch (err) {
                    showToast('นำเข้าข้อมูลล้มเหลว', 'error');
                } finally {
                    setImporting(false);
                }
            },
            error: () => {
                showToast('อ่านไฟล์ CSV ล้มเหลว', 'error');
                setImporting(false);
            }
        });
        e.target.value = ''; // Reset input
    };

    const openModal = (mold = null) => {
        if (mold) {
            setFormData({ ...mold });
            setEditingId(mold.id);
        } else {
            setFormData({ mold_code: '', mold_name: '', dwg_part1: '', part_name: '', vendor: '', machine_no: '', cavity: '', mold_type: '2-plate' });
            setEditingId(null);
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const filteredMolds = molds.filter(m => 
        (m.mold_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.mold_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.dwg_part1 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.vendor || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
            h('div', null,
                h('h2', { className: 'text-lg font-semibold text-white' }, 'ฐานข้อมูลแม่พิมพ์ (Database)'),
                h('p', { className: 'text-sm text-surface-400' }, vendorAccess === 'ALL' ? 'จัดการรายการแม่พิมพ์ทั้งหมด' : `รายการแม่พิมพ์ของ: ${vendorAccess}`)
            ),
            isAdmin && h('div', { className: 'flex gap-3' },
                h('label', { className: 'btn btn-secondary cursor-pointer' },
                    importing ? h('i', { className: 'fa-solid fa-spinner fa-spin mr-2' }) : h('i', { className: 'fa-solid fa-file-import mr-2' }),
                    importing ? 'กำลังนำเข้า...' : 'Import CSV',
                    h('input', { type: 'file', accept: '.csv', className: 'hidden', onChange: handleCSVImport, disabled: importing })
                ),
                h('button', { className: 'btn btn-primary', onClick: () => openModal() },
                    h('i', { className: 'fa-solid fa-plus mr-2' }), 'เพิ่มแม่พิมพ์'
                )
            )
        ),

        // Search
        h('div', { className: 'card' },
            h('div', { className: 'relative max-w-md' },
                h('i', { className: 'fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-500' }),
                h('input', {
                    className: 'input pl-10',
                    placeholder: 'ค้นหา ASSET1, ชื่อ, หรือ Part...',
                    value: searchTerm,
                    onChange: e => setSearchTerm(e.target.value)
                })
            )
        ),

        // Table
        h('div', { className: 'card p-0 overflow-hidden' },
            h('div', { className: 'overflow-x-auto' },
                h('table', { className: 'data-table' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'ASSET1'),
                            h('th', null, 'NAME MOLD'),
                            h('th', null, 'DWG PART'),
                            h('th', null, 'PART NAME'),
                            h('th', null, 'VENDOR'),
                            isAdmin && h('th', { className: 'text-right' }, 'จัดการ')
                        )
                    ),
                    h('tbody', null,
                        loading ? h('tr', null, h('td', { colSpan: 6, className: 'text-center py-10' }, h('div', { className: 'loading-spinner mx-auto' })))
                        : filteredMolds.length === 0 ? h('tr', null, h('td', { colSpan: 6, className: 'text-center py-10 text-surface-500' }, 'ไม่พบข้อมูลแม่พิมพ์'))
                        : filteredMolds.map((m, i) => 
                            h('tr', { key: m.id, className: 'animate-slide-up', style: { animationDelay: (i * 30) + 'ms' } },
                                h('td', { className: 'font-bold text-primary-400' }, m.mold_code),
                                h('td', null, m.mold_name || '-'),
                                h('td', null, h('span', { className: 'text-xs px-2 py-0.5 rounded-lg bg-white/5 border border-white/10' }, m.dwg_part1 || '-')),
                                h('td', null, m.part_name || '-'),
                                h('td', null, h('span', { className: 'text-xs' }, m.vendor || '-')),
                                isAdmin && h('td', { className: 'text-right' },
                                    h('div', { className: 'flex justify-end gap-2' },
                                        h('button', { className: 'btn btn-ghost btn-sm text-primary-400 hover:bg-primary-500/10', onClick: () => openModal(m) }, h('i', { className: 'fa-solid fa-edit' })),
                                        h('button', { className: 'btn btn-ghost btn-sm text-red-400 hover:bg-red-500/10', onClick: () => deleteMold(m.id) }, h('i', { className: 'fa-solid fa-trash-can' }))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ),

        // Modal for Add/Edit
        showModal && h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm' },
            h('div', { className: 'card w-full max-w-lg animate-scale-in' },
                h('div', { className: 'flex items-center justify-between mb-6' },
                    h('h3', { className: 'text-lg font-bold text-white' }, editingId ? 'แก้ไขข้อมูลแม่พิมพ์' : 'เพิ่มข้อมูลแม่พิมพ์ใหม่'),
                    h('button', { className: 'btn btn-ghost btn-sm', onClick: closeModal }, h('i', { className: 'fa-solid fa-times' }))
                ),
                h('div', { className: 'grid grid-cols-2 gap-4' },
                    h('div', { className: 'col-span-2' },
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1' }, 'ASSET1 (Mold Code) *'),
                        h('input', { className: 'input', value: formData.mold_code, onChange: e => setFormData({...formData, mold_code: e.target.value}), disabled: !!editingId })
                    ),
                    h('div', { className: 'col-span-2' },
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1' }, 'NAME MOLD'),
                        h('input', { className: 'input', value: formData.mold_name, onChange: e => setFormData({...formData, mold_name: e.target.value}) })
                    ),
                    h('div', { className: 'col-span-2' },
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1' }, 'DWG PART'),
                        h('input', { className: 'input', value: formData.dwg_part1, onChange: e => setFormData({...formData, dwg_part1: e.target.value}) })
                    ),
                    h('div', { className: 'col-span-2' },
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1' }, 'PART NAME'),
                        h('input', { className: 'input', value: formData.part_name, onChange: e => setFormData({...formData, part_name: e.target.value}) })
                    ),
                    h('div', null,
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1' }, 'VENDOR'),
                        h('input', { className: 'input', value: formData.vendor, onChange: e => setFormData({...formData, vendor: e.target.value}) })
                    ),
                    h('div', null,
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1' }, 'CAV'),
                        h('input', { type: 'number', className: 'input', value: formData.cavity, onChange: e => setFormData({...formData, cavity: e.target.value}) })
                    ),
                ),
                h('div', { className: 'flex justify-end gap-3 mt-8' },
                    h('button', { className: 'btn btn-secondary', onClick: closeModal }, 'ยกเลิก'),
                    h('button', { className: 'btn btn-primary', onClick: handleSaveMold }, 'บันทึกข้อมูล')
                )
            )
        )
    );
}

window.PartsPage = PartsPage;
