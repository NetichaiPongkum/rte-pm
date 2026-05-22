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
                
                // Order by newest first to get the latest records
                query = query.order('created_at', { ascending: false });
                
                // If no date filters are set, limit to 50 records
                if (!startDate && !endDate) {
                    query = query.limit(50);
                }
                
                const { data: fetchedData, error } = await query;
                if (error) throw error;
                
                // Reverse so doc_no generation counts from oldest to newest within the chunk
                const allData = (fetchedData || []).reverse();
                
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
                        vendor: (r.vendor !== undefined && r.vendor !== null && r.vendor !== '') ? r.vendor : (moldsMap[r.mold_code]?.vendor || '-'),
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

    const handleDeleteRecord = async (record) => {
        if (user?.role !== 'admin') {
            showToast('คุณไม่มีสิทธิ์ลบข้อมูล', 'error');
            return;
        }

        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายการของแม่พิมพ์ ${record.mold_code} เมื่อวันที่ ${record.performed_date}?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) {
            return;
        }

        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient
                    .from('inspection_records')
                    .delete()
                    .eq('id', record.id);
                if (error) throw error;
            } else {
                // Demo mode
                let demoRecords = JSON.parse(localStorage.getItem('demo_inspection_records') || '[]');
                demoRecords = demoRecords.filter(r => r.id !== record.id);
                localStorage.setItem('demo_inspection_records', JSON.stringify(demoRecords));
            }

            showToast('ลบรายการสำเร็จ', 'success');
            loadRecords();
        } catch (err) {
            console.error('Delete record error:', err);
            showToast('ลบรายการไม่สำเร็จ', 'error');
        }
    };

    const getTypeInfo = (id) => ({ label: 'Type ' + id, icon: 'fa-book', color: 'from-primary-500 to-primary-600' });

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
                        <div style="display: flex; margin-bottom: 3px;"><span style="font-weight: bold; width: 90px; color: #555;">DWG / Part:</span> <span style="flex: 1; border-bottom: 1px dotted #ccc; color: #000;">${record.dwg_part1 || '-'} / ${record.part_name || '-'}</span></div>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; margin-bottom: 3px;"><span style="font-weight: bold; width: 90px; color: #555;">Vendor:</span> <span style="flex: 1; border-bottom: 1px dotted #ccc; color: #000;">${record.vendor || '-'}</span></div>
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

    const exportToExcel = () => {
        if (filteredRecords.length === 0) return showToast('ไม่มีข้อมูลที่จะส่งออก', 'warning');
        
        // CSV Header
        let csvContent = "\uFEFF"; // BOM for UTF-8
        csvContent += "Date,Mold Code,Mold Name,Category,Vendor,Performed By,Status\n";
        
        // Data Rows
        filteredRecords.forEach(r => {
            const row = [
                r.performed_date,
                r.mold_code,
                r.mold_name,
                r.category_name,
                r.vendor,
                r.performed_by,
                'Completed'
            ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",");
            csvContent += row + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Inspection_History_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportRecordToExcel = (record) => {
        const data = Array.isArray(record.checklist_data) ? record.checklist_data : [];
        let csvContent = "\uFEFF";
        csvContent += `Mold Inspection Sheet: ${record.mold_code} (${record.mold_name || '-'})\n`;
        csvContent += `DOC NO: ${record.doc_no || record.id?.slice(-8).toUpperCase() || '-'}\n`;
        csvContent += `Category: ${record.category_name || '-'}, Vendor: ${record.vendor || '-'}\n`;
        csvContent += `Performed By: ${record.performed_by || '-'}, Date: ${record.performed_date || '-'}\n\n`;
        csvContent += "No.,Inspection Item,Result\n";
        
        data.forEach((item, idx) => {
            const row = [
                idx + 1,
                item.name,
                item.result || 'N/A'
            ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",");
            csvContent += row + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Inspection_Record_${record.mold_code}_${record.performed_date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
            h('div', null,
                h('h2', { className: 'text-lg font-semibold' }, 'Inspection summary'),
                h('p', { className: 'text-sm text-surface-400' }, 'สรุปผลการตรวจสอบชิ้นงานและแม่พิมพ์')
            ),
            h('div', { className: 'flex gap-2' },
                h('button', { 
                    className: 'btn btn-secondary btn-sm', 
                    onClick: () => exportToExcel() 
                }, h('i', { className: 'fa-solid fa-file-excel mr-2 text-emerald-500' }), 'Export Excel'),
                h('button', { className: 'btn btn-secondary btn-sm', onClick: loadRecords },
                    h('i', { className: 'fa-solid fa-sync mr-2' }), 'รีเฟรช'
                )
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
                            h('th', null, 'Vendor'),
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
                                    return h('tr', { 
                                        key: r.id, 
                                        className: 'animate-slide-up cursor-pointer hover:bg-primary-500/5', 
                                        onClick: () => setSelectedRecord(r)
                                    },
                                        h('td', { className: 'whitespace-nowrap' }, h('span', { className: 'text-xs' }, r.performed_date || '-')),
                                        h('td', null, h('span', { className: 'font-bold text-primary-400' }, r.mold_code)),
                                        h('td', null, h('p', { className: 'text-xs text-white' }, r.mold_name || '-')),
                                        h('td', null, h('span', { className: 'badge badge-primary text-[10px]' }, r.category_name)),
                                        h('td', null, h('span', { className: 'badge badge-info' }, r.vendor || '-')),
                                        h('td', { className: 'whitespace-nowrap' }, h('span', { className: 'text-xs' }, r.performed_by)),
                                        h('td', { className: 'text-right whitespace-nowrap' },
                                            h('div', { className: 'flex justify-end gap-0.5', onClick: e => e.stopPropagation() },
                                                 user?.role === 'admin' && h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-amber-400 hover:bg-amber-500/10 px-2',
                                                    title: 'Edit Record',
                                                    onClick: () => { setEditingRecord(r); setEditFormData(JSON.parse(JSON.stringify(r))); }
                                                }, h('i', { className: 'fa-solid fa-pen-to-square' })),
                                                user?.role === 'admin' && h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-red-400 hover:bg-red-500/10 px-2',
                                                    title: 'Delete Record',
                                                    onClick: () => handleDeleteRecord(r)
                                                }, h('i', { className: 'fa-solid fa-trash' })),
                                                h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-primary-400 hover:bg-primary-500/10 px-2',
                                                    title: 'View Details',
                                                    onClick: () => setSelectedRecord(r)
                                                }, h('i', { className: 'fa-solid fa-eye' })),
                                                h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-primary-400 hover:bg-white/10 px-2', 
                                                    title: 'Download PDF',
                                                    onClick: () => downloadPDF(r) 
                                                }, h('i', { className: 'fa-solid fa-file-pdf' })),
                                                h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-emerald-400 hover:bg-white/10 px-2', 
                                                    title: 'Download Excel',
                                                    onClick: () => exportRecordToExcel(r) 
                                                }, h('i', { className: 'fa-solid fa-file-excel' }))
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
            h('div', { className: 'card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10' },
                // Modal Header
                h('div', { className: 'flex justify-between items-start p-6 border-b border-white/5 bg-surface-800' },
                    h('div', null,
                        h('h3', { className: 'text-lg font-bold text-white' }, 'รายละเอียดการตรวจสอบ (Inspection Details)'),
                        h('p', { className: 'text-sm text-surface-400 mt-1 font-mono' }, `DOC NO: ${selectedRecord.doc_no || selectedRecord.id?.slice(-8).toUpperCase() || '-'}`)
                    ),
                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setSelectedRecord(null) }, h('i', { className: 'fa-solid fa-times' }))
                ),

                // Modal Content
                h('div', { className: 'flex-1 overflow-y-auto p-6 space-y-6' },
                    // Info Cards
                    h('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Mold Code'),
                            h('p', { className: 'text-sm font-bold text-primary-400' }, selectedRecord.mold_code)
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5 md:col-span-2' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Mold Name / ชื่อแม่พิมพ์'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedRecord.mold_name || '-')
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Vendor'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedRecord.vendor || '-')
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Date'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedRecord.performed_date)
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Performed By'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedRecord.performed_by)
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Category'),
                            h('p', { className: 'text-xs font-bold text-white truncate' }, selectedRecord.category_name || '-')
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'DWG / Part'),
                            h('p', { className: 'text-xs font-bold text-white truncate' }, `${selectedRecord.dwg_part1 || '-'} / ${selectedRecord.part_name || '-'}`)
                        )
                    ),

                    // Checklist Table
                    h('div', { className: 'space-y-3' },
                        h('h4', { className: 'text-sm font-bold text-surface-300' }, 'Inspection Checklist Items'),
                        h('div', { className: 'overflow-hidden rounded-xl border border-white/5' },
                            h('table', { className: 'w-full text-sm' },
                                h('thead', { className: 'bg-white/5 text-[10px] uppercase text-surface-500' },
                                    h('tr', null,
                                        h('th', { className: 'p-3 text-left' }, 'No.'),
                                        h('th', { className: 'p-3 text-left' }, 'Category'),
                                        h('th', { className: 'p-3 text-left' }, 'Item'),
                                        h('th', { className: 'p-3 text-center' }, 'Result')
                                    )
                                ),
                                h('tbody', { className: 'divide-y divide-white/5' },
                                    (selectedRecord.checklist_data || []).map((item, idx) => h('tr', { key: idx, className: 'hover:bg-white/[0.02]' },
                                        h('td', { className: 'p-3 text-surface-500' }, idx + 1),
                                        h('td', { className: 'p-3 text-surface-400 text-xs' }, item.category || '-'),
                                        h('td', { className: 'p-3 text-white' }, item.name),
                                        h('td', { className: 'p-3 text-center' },
                                            h('span', { className: `font-bold uppercase text-[10px] ${
                                                item.result === 'pass' ? 'text-emerald-400'
                                                : item.result === 'fail' ? 'text-red-400'
                                                : 'text-surface-500'
                                            }` }, item.result || 'N/A')
                                        )
                                    ))
                                )
                            )
                        )
                    ),

                    // Notes
                    h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                        h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-2' }, 'Notes / หมายเหตุ'),
                        h('p', { className: 'text-sm text-surface-200 italic' }, selectedRecord.notes || 'ไม่มีหมายเหตุเพิ่มเติม')
                    )
                ),

                // Modal Footer
                h('div', { className: 'p-6 border-t border-white/5 bg-surface-800 flex flex-wrap gap-3 justify-end' },
                    h('button', { 
                        className: 'btn btn-primary',
                        onClick: () => downloadPDF(selectedRecord)
                    }, h('i', { className: 'fa-solid fa-file-pdf mr-2' }), 'Export PDF'),
                    h('button', { 
                        className: 'btn bg-emerald-600 hover:bg-emerald-500 text-white',
                        onClick: () => exportRecordToExcel(selectedRecord)
                    }, h('i', { className: 'fa-solid fa-file-excel mr-2' }), 'Download Excel'),
                    h('button', { 
                        className: 'btn btn-ghost',
                        onClick: () => setSelectedRecord(null)
                    }, 'ปิดหน้าต่าง')
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
