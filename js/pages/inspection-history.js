// ==========================================
// INSPECTION HISTORY PAGE - Summary of completed Inspections
// ==========================================

function InspectionHistoryPage({ user, showToast }) {
    const h = React.createElement;
    const [records, setRecords] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');
    const [selectedRecord, setSelectedRecord] = React.useState(null);
    const [editingRecord, setEditingRecord] = React.useState(null);
    const [editFormData, setEditFormData] = React.useState(null);
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [filterVendor, setFilterVendor] = React.useState('all');
    const [availableVendors, setAvailableVendors] = React.useState([]);
    const vendorAccess = user?.vendor_access || 'ALL';

    React.useEffect(() => {
        const fetchVendors = async () => {
            if (window.supabaseClient && vendorAccess === 'ALL') {
                const { data } = await window.supabaseClient.from('mold_master').select('vendor');
                if (data) {
                    const unique = [...new Set(data.map(m => m.vendor).filter(Boolean))].sort();
                    setAvailableVendors(unique);
                }
            } else if (vendorAccess !== 'ALL') {
                setAvailableVendors(vendorAccess.split(',').map(v => v.trim()).filter(Boolean));
            } else {
                setAvailableVendors(['SPP', 'RTE', 'MOLD-A', 'VENDOR-B']);
            }
        };
        fetchVendors();
    }, [vendorAccess]);

    React.useEffect(() => {
        loadRecords();
    }, [vendorAccess, startDate, endDate, filterVendor]);

    const loadRecords = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                let accessibleMoldCodes = null;
                if (vendorAccess !== 'ALL') {
                    const vendors = vendorAccess.split(',').map(v => v.trim()).filter(v => v);
                    const { data: moldData } = await window.supabaseClient
                        .from('mold_master')
                        .select('mold_code')
                        .in('vendor', vendors);
                    accessibleMoldCodes = (moldData || []).map(m => m.mold_code);
                }

                let query = window.supabaseClient.from('inspection_records').select('*');
                
                if (startDate) {
                    query = query.gte('performed_date', startDate);
                }
                if (endDate) {
                    query = query.lte('performed_date', endDate);
                }
                
                const { data: allData, error } = await query.order('created_at', { ascending: true });
                if (error) throw error;
                
                const { data: allMolds } = await window.supabaseClient.from('mold_master').select('mold_code, mold_name, dwg_part1, part_name, vendor');
                const moldsMap = {};
                (allMolds || []).forEach(m => moldsMap[m.mold_code] = m);

                const dateCounters = {};
                let enrichedRecords = (allData || []).map(r => {
                    const dateStr = (r.performed_date || r.created_at.split('T')[0]).replace(/-/g, '');
                    if (!dateCounters[dateStr]) dateCounters[dateStr] = 1;
                    else dateCounters[dateStr]++;
                    
                    const seq = String(dateCounters[dateStr]).padStart(4, '0');
                    return {
                        ...r,
                        doc_no: `RTE-INSP-${dateStr}-${seq}`,
                        mold_name: moldsMap[r.mold_code]?.mold_name || '-',
                        dwg_part1: moldsMap[r.mold_code]?.dwg_part1 || '-',
                        part_name: moldsMap[r.mold_code]?.part_name || '-',
                        vendor: moldsMap[r.mold_code]?.vendor || '-',
                    };
                });

                if (filterVendor !== 'all') {
                    enrichedRecords = enrichedRecords.filter(r => r.vendor === filterVendor);
                }

                if (accessibleMoldCodes) {
                    if (accessibleMoldCodes.length === 0) {
                        setRecords([]);
                        setLoading(false);
                        return;
                    }
                    enrichedRecords = enrichedRecords.filter(r => accessibleMoldCodes.includes(r.mold_code));
                }

                let filteredEnriched = enrichedRecords;
                if (startDate) filteredEnriched = filteredEnriched.filter(r => r.performed_date >= startDate);
                if (endDate) filteredEnriched = filteredEnriched.filter(r => r.performed_date <= endDate);
                if (filterVendor !== 'all') filteredEnriched = filteredEnriched.filter(r => r.vendor === filterVendor);
                
                setRecords(filteredEnriched.reverse());
            } else {
                let demoRecords = JSON.parse(localStorage.getItem('demo_inspection_records') || '[]');
                const enrichedRecords = demoRecords.map(r => ({
                    ...r,
                    doc_no: `RTE-INSP-DEMO`,
                    mold_name: 'DEMO MOLD',
                    dwg_part1: 'DEMO-DWG',
                    part_name: 'DEMO PART'
                }));
                setRecords(enrichedRecords);
            }
        } catch (err) {
            console.error('Load inspection records error:', err);
            showToast('โหลดข้อมูลประวัติล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient
                    .from('inspection_records')
                    .update({
                        performed_by: editFormData.performed_by,
                        performed_date: editFormData.performed_date,
                        notes: editFormData.notes,
                        checklist_data: editFormData.checklist_data
                    })
                    .eq('id', editingRecord.id);
                if (error) throw error;
            }
            showToast('บันทึกการแก้ไขสำเร็จ', 'success');
            setEditingRecord(null);
            loadRecords();
        } catch (err) {
            showToast('บันทึกไม่สำเร็จ', 'error');
        }
    };

    const getTypeInfo = (id) => ({ label: 'Type ' + id, icon: 'fa-microscope', color: 'from-primary-500 to-primary-600' });

    const filteredRecords = records.filter(r => {
        const matchesSearch = (r.mold_code || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (r.category_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || r.pm_level === filterType;
        return matchesSearch && matchesType;
    });

    const downloadPDF = (record) => {
        if (!window.html2pdf) {
            showToast('กำลังโหลดไลบรารี PDF กรุณารอสักครู่', 'warning');
            return;
        }

        const data = Array.isArray(record.checklist_data) ? record.checklist_data : [];
        const typeInfo = getTypeInfo(record.pm_level);
        
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.innerHTML = `
            <div id="pdf-content" style="padding: 30px 40px; font-family: 'Inter', 'Noto Sans Thai', sans-serif; color: #1a1a1a; font-size: 10px; width: 794px; height: 1122px; box-sizing: border-box; background: white; position: relative; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px;">
                    <div>
                        <h1 style="margin: 0; font-size: 16px; color: #000; font-weight: 800;">MOLD INSPECTION SHEET</h1>
                        <p style="margin: 2px 0 0; color: #666; font-size: 10px;">ระบบจัดการงานตรวจสอบแม่พิมพ์ (Inspection Mold)</p>
                    </div>
                    <div style="text-align: right">
                        <div style="font-weight: bold; color: #6366f1; font-size: 12px;">${record.category_name || '-'}</div>
                        <div style="font-size: 9px; color: #666;">DOC NO: ${record.doc_no || '-'}</div>
                    </div>
                </div>

                <div style="display: flex; gap: 15px; margin-bottom: 10px; background: #fcfcfc; padding: 8px; border: 1px solid #eee; border-radius: 4px;">
                    <div style="flex: 1;">
                        <div style="display: flex; margin-bottom: 3px;"><span style="font-weight: bold; width: 90px; color: #555;">Asset Code:</span> <span style="font-weight: 700; flex: 1; border-bottom: 1px dotted #ccc; color: #000;">${record.mold_code || '-'}</span></div>
                        <div style="display: flex; margin-bottom: 3px;"><span style="font-weight: bold; width: 90px; color: #555;">Name:</span> <span style="flex: 1; border-bottom: 1px dotted #ccc; color: #000;">${record.mold_name || '-'}</span></div>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; margin-bottom: 3px;"><span style="font-weight: bold; width: 90px; color: #555;">Performed By:</span> <span style="flex: 1; border-bottom: 1px dotted #ccc; color: #000;">${record.performed_by || '-'}</span></div>
                        <div style="display: flex; margin-bottom: 3px;"><span style="font-weight: bold; width: 90px; color: #555;">Date:</span> <span style="flex: 1; border-bottom: 1px dotted #ccc; color: #000;">${record.performed_date || '-'}</span></div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed;">
                    <thead>
                        <tr>
                            <th style="width: 30px; background: #f0f0f0; text-align: left; padding: 4px 6px; border: 1px solid #333; font-size: 10px;">No.</th>
                            <th style="background: #f0f0f0; text-align: left; padding: 4px 6px; border: 1px solid #333; font-size: 10px;">Inspection Item / รายการตรวจสอบ</th>
                            <th style="width: 60px; text-align: center; background: #f0f0f0; padding: 4px 6px; border: 1px solid #333; font-size: 10px;">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, idx) => `
                            <tr>
                                <td style="text-align: center; padding: 3px 6px; border: 1px solid #333; font-size: 10px;">${idx + 1}</td>
                                <td style="padding: 3px 6px; border: 1px solid #333; font-size: 10px;">${item.name}</td>
                                <td style="text-align: center; padding: 3px 6px; border: 1px solid #333; font-size: 10px;">
                                    <span style="font-weight: bold; text-transform: uppercase; padding: 1px 4px; border: 1px solid #333; font-size: 8px; display: inline-block; background: ${item.result === 'pass' ? '#d1fae5' : item.result === 'fail' ? '#fee2e2' : '#f3f4f6'};">${item.result || 'N/A'}</span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 5px; padding: 6px; border: 1px solid #333; min-height: 40px;">
                    <div style="font-weight: bold; margin-bottom: 2px;">Notes / หมายเหตุ:</div>
                    <div style="font-size: 9px;">${record.notes || '-'}</div>
                </div>

                <div style="position: absolute; bottom: 40px; left: 40px; right: 40px; display: flex; justify-content: space-between; gap: 40px;">
                    <div style="flex: 1; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 10px;">
                        <p style="margin-bottom: 25px;">Inspected By (ผู้ตรวจสอบ)</p>
                        <p>${record.performed_by}</p>
                    </div>
                    <div style="flex: 1; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 10px;">
                        <p style="margin-bottom: 25px;">Acknowledged By</p>
                        <p style="color: #ccc;">__________________________</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        const element = document.getElementById('pdf-content');
        const opt = {
            margin:       0,
            filename:     `Inspection_Record_${record.mold_code}_${record.performed_date}.pdf`,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(element).save().then(() => {
            document.body.removeChild(container);
            showToast('ดาวน์โหลด PDF สำเร็จ', 'success');
        }).catch(err => {
            document.body.removeChild(container);
            showToast('ดาวน์โหลด PDF ล้มเหลว', 'error');
        });
    };

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
            h('div', null,
                h('h2', { className: 'text-lg font-semibold' }, 'Inspection summary'),
                h('p', { className: 'text-sm text-surface-400' }, 'สรุปผลการตรวจสอบชิ้นงานและแม่พิมพ์')
            ),
            h('button', { className: 'btn btn-secondary btn-sm', onClick: loadRecords },
                h('i', { className: 'fa-solid fa-sync mr-2' }), 'รีเฟรช'
            )
        ),

        // Filters
        h('div', { className: 'card flex flex-col md:flex-row gap-4 items-center justify-between' },
            h('div', { className: 'flex gap-3 w-full md:w-auto flex-wrap' },
                h('div', { className: 'relative w-full md:w-64' },
                    h('i', { className: 'fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm' }),
                    h('input', {
                        className: 'input pl-10 w-full',
                        placeholder: 'ค้นหารหัส...',
                        value: searchTerm,
                        onChange: e => setSearchTerm(e.target.value)
                    })
                ),
                h('div', { className: 'flex items-center gap-2' },
                    h('input', {
                        type: 'date',
                        className: 'input bg-surface-800 text-sm py-1.5 w-36 cursor-pointer border border-white/10 text-white',
                        value: startDate,
                        onChange: e => setStartDate(e.target.value)
                    }),
                    h('span', { className: 'text-surface-500 text-sm' }, '-'),
                    h('input', {
                        type: 'date',
                        className: 'input bg-surface-800 text-sm py-1.5 w-36 cursor-pointer border border-white/10 text-white',
                        value: endDate,
                        onChange: e => setEndDate(e.target.value)
                    })
                ),
                h('select', {
                    className: 'input bg-surface-800 text-sm py-1.5 w-32 cursor-pointer border border-white/10 text-white',
                    value: filterVendor,
                    onChange: e => setFilterVendor(e.target.value)
                },
                    h('option', { value: 'all' }, 'ทุก Vendor'),
                    availableVendors.map(v => h('option', { key: v, value: v }, v))
                )
            ),
            h('div', { className: 'flex gap-2 w-full md:w-auto overflow-x-auto' },
                h('button', {
                    className: `btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}`,
                    onClick: () => setFilterType('all')
                }, 'ทั้งหมด')
            )
        ),

        // Table
        h('div', { className: 'card overflow-hidden p-0' },
            h('div', { className: 'overflow-x-auto' },
                h('table', { className: 'data-table' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'วันที่'),
                            h('th', null, 'รหัส'),
                            h('th', null, 'ชื่อแม่พิมพ์'),
                            h('th', null, 'หมวดหมู่'),
                            h('th', null, 'ผลลัพธ์ (P/F/NA)'),
                            h('th', null, 'ผู้ตรวจสอบ'),
                            h('th', { className: 'text-right' }, 'Action')
                        )
                    ),
                    h('tbody', null,
                        loading
                            ? h('tr', null, h('td', { colSpan: 7, className: 'text-center py-10' }, h('div', { className: 'loading-spinner mx-auto' })))
                            : filteredRecords.length === 0
                                ? h('tr', null, h('td', { colSpan: 7, className: 'text-center py-10 text-surface-500' }, 'ไม่พบข้อมูล Inspection summary'))
                                : filteredRecords.map((r, i) => {
                                    const data = Array.isArray(r.checklist_data) ? r.checklist_data : [];
                                    const counts = {
                                        pass: data.filter(d => d.result === 'pass').length,
                                        fail: data.filter(d => d.result === 'fail').length,
                                        na:   data.filter(d => d.result === 'na').length
                                    };

                                    return h('tr', { 
                                        key: r.id, 
                                        className: 'animate-slide-up cursor-pointer hover:bg-primary-500/5', 
                                        onClick: () => setSelectedRecord(r)
                                    },
                                        h('td', null, h('span', { className: 'text-xs' }, r.performed_date || '-')),
                                        h('td', null, h('span', { className: 'font-bold text-primary-400' }, r.mold_code)),
                                        h('td', null, h('p', { className: 'text-xs text-white' }, r.mold_name || '-')),
                                        h('td', null, h('span', { className: 'badge badge-primary text-[10px]' }, r.category_name)),
                                        h('td', null, 
                                            h('div', { className: 'flex gap-1 text-[10px]' },
                                                h('span', { className: 'text-emerald-400 font-bold' }, counts.pass),
                                                h('span', { className: 'text-surface-600' }, '/'),
                                                h('span', { className: 'text-red-400 font-bold' }, counts.fail),
                                                h('span', { className: 'text-surface-600' }, '/'),
                                                h('span', { className: 'text-surface-400 font-bold' }, counts.na)
                                            )
                                        ),
                                        h('td', null, h('span', { className: 'text-xs' }, r.performed_by)),
                                        h('td', { className: 'text-right' },
                                            h('div', { className: 'flex justify-end gap-1', onClick: e => e.stopPropagation() },
                                                user?.role === 'admin' && h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-amber-400',
                                                    onClick: () => { setEditingRecord(r); setEditFormData(JSON.parse(JSON.stringify(r))); }
                                                }, h('i', { className: 'fa-solid fa-pen-to-square' })),
                                                h('button', { className: 'btn btn-ghost btn-xs text-primary-400', onClick: () => downloadPDF(r) }, h('i', { className: 'fa-solid fa-file-pdf' }))
                                            )
                                        )
                                    );
                                })
                    )
                )
            )
        ),

        // Details Modal
        selectedRecord && h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in' },
            h('div', { className: 'card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col' },
                h('div', { className: 'flex justify-between items-start p-6 border-b border-white/5 bg-surface-800' },
                    h('div', null,
                        h('h3', { className: 'text-lg font-bold text-white' }, 'รายละเอียดการตรวจสอบ (Inspection Details)'),
                        h('p', { className: 'text-sm text-surface-400 font-mono' }, `DOC: ${selectedRecord.doc_no || '-'}`)
                    ),
                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setSelectedRecord(null) }, h('i', { className: 'fa-solid fa-times' }))
                ),
                h('div', { className: 'flex-1 overflow-y-auto p-6 space-y-4' },
                    h('div', { className: 'grid grid-cols-2 gap-4' },
                        h('div', { className: 'p-3 rounded-lg bg-white/5' }, h('p', { className: 'text-[10px] text-surface-500 uppercase' }, 'Mold Code'), h('p', { className: 'text-sm font-bold' }, selectedRecord.mold_code)),
                        h('div', { className: 'p-3 rounded-lg bg-white/5' }, h('p', { className: 'text-[10px] text-surface-500 uppercase' }, 'Date'), h('p', { className: 'text-sm font-bold' }, selectedRecord.performed_date))
                    ),
                    h('div', { className: 'space-y-2' },
                        (selectedRecord.checklist_data || []).map((item, idx) => h('div', { key: idx, className: 'flex justify-between text-sm p-2 border-b border-white/5' },
                            h('span', { className: 'text-surface-300' }, item.name),
                            h('span', { className: `font-bold uppercase ${item.result === 'pass' ? 'text-emerald-400' : 'text-red-400'}` }, item.result)
                        ))
                    )
                ),
                h('div', { className: 'p-6 border-t border-white/5 flex justify-end gap-3' },
                    h('button', { className: 'btn btn-primary', onClick: () => downloadPDF(selectedRecord) }, 'Export PDF'),
                    h('button', { className: 'btn btn-ghost', onClick: () => setSelectedRecord(null) }, 'ปิด')
                )
            )
        ),

        // Edit Modal (Simplified)
        editingRecord && h('div', { className: 'fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md' },
            h('div', { className: 'card w-full max-w-2xl' },
                h('div', { className: 'p-6 border-b border-white/5' }, h('h3', { className: 'text-lg font-bold' }, 'แก้ไขข้อมูลตรวจสอบ')),
                h('div', { className: 'p-6 space-y-4' },
                    h('input', { type: 'date', className: 'input w-full', value: editFormData.performed_date, onChange: e => setEditFormData({ ...editFormData, performed_date: e.target.value }) }),
                    h('textarea', { className: 'input w-full', value: editFormData.notes || '', onChange: e => setEditFormData({ ...editFormData, notes: e.target.value }) })
                ),
                h('div', { className: 'p-6 border-t border-white/5 flex justify-end gap-3' },
                    h('button', { className: 'btn btn-ghost', onClick: () => setEditingRecord(null) }, 'ยกเลิก'),
                    h('button', { className: 'btn btn-primary', onClick: handleSaveEdit }, 'บันทึก')
                )
            )
        )
    );
}

window.InspectionHistoryPage = InspectionHistoryPage;
