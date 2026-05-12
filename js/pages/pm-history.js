// ==========================================
// PM HISTORY PAGE - Summary of completed PMs
// ==========================================

function PMHistoryPage({ user, showToast }) {
    const h = React.createElement;
    const [records, setRecords] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');
    const [selectedRecord, setSelectedRecord] = React.useState(null);

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
                              (r.category_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || r.pm_level === filterType;
        return matchesSearch && matchesType;
    });

    const exportCheckSheet = (record) => {
        const data = Array.isArray(record.checklist_data) ? record.checklist_data : [];
        const typeInfo = getTypeInfo(record.pm_level);
        
        const printWindow = window.open('', '_blank');
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>PM Check Sheet - ${record.mold_code}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4; margin: 10mm; }
                    body { font-family: 'Inter', 'Noto Sans Thai', sans-serif; padding: 0; color: #1a1a1a; line-height: 1.3; font-size: 11px; margin: 0; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
                    .header-title h1 { margin: 0; font-size: 18px; color: #000; font-weight: 800; }
                    .header-title p { margin: 2px 0 0; color: #666; font-size: 11px; }
                    .info-grid { display: grid; grid-template-cols: 1.2fr 1fr; gap: 15px; margin-bottom: 15px; background: #fcfcfc; padding: 10px; border: 1px solid #eee; border-radius: 4px; }
                    .info-item { display: flex; margin-bottom: 4px; }
                    .info-label { font-weight: bold; width: 120px; color: #555; }
                    .info-value { color: #000; flex: 1; border-bottom: 1px dotted #ccc; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; table-layout: fixed; }
                    th { background: #f0f0f0; text-align: left; padding: 8px; border: 1px solid #333; font-size: 11px; }
                    td { padding: 6px 8px; border: 1px solid #333; font-size: 11px; word-wrap: break-word; }
                    .result-badge { font-weight: bold; text-transform: uppercase; padding: 1px 6px; border: 1px solid #333; font-size: 9px; display: inline-block; }
                    .result-pass { background: #d1fae5 !important; }
                    .result-fail { background: #fee2e2 !important; }
                    .notes-section { margin-top: 10px; padding: 8px; border: 1px solid #333; min-height: 50px; }
                    .notes-title { font-weight: bold; margin-bottom: 4px; }
                    .footer { margin-top: 30px; display: grid; grid-template-cols: 1fr 1fr; gap: 40px; }
                    .sign-box { border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 11px; }
                    @media print {
                        .no-print { display: none; }
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-title">
                        <h1>PREVENTIVE MAINTENANCE CHECK SHEET</h1>
                        <p>ระบบจัดการงานบำรุงรักษาแม่พิมพ์ (PM Mold RTE)</p>
                    </div>
                    <div style="text-align: right">
                        <div style="font-weight: bold; color: #4f46e5; font-size: 14px;">${typeInfo.label || 'PM Level ' + (record.pm_level || '-')}</div>
                        <div style="font-size: 10px; color: #666;">DOC NO: PM-RTE-${(record.id || Date.now()).toString().slice(-6).toUpperCase()}</div>
                    </div>
                </div>

                <div class="info-grid">
                    <div>
                        <div class="info-item"><span class="info-label">Mold Code / รหัส:</span> <span class="info-value" style="font-weight: 700;">${record.mold_code || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Category / หมวดหมู่:</span> <span class="info-value">${record.category_name || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Performed By / ผู้ตรวจ:</span> <span class="info-value">${record.performed_by || '-'}</span></div>
                    </div>
                    <div>
                        <div class="info-item"><span class="info-label">Date / วันที่:</span> <span class="info-value">${record.performed_date || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Status / สถานะ:</span> <span class="info-value">Completed / เสร็จสิ้น</span></div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px">No.</th>
                            <th style="width: 90px">Category</th>
                            <th>Inspection Item / รายการตรวจสอบ</th>
                            <th style="width: 70px; text-align: center;">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, idx) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td style="color: #666; font-size: 10px;">${item.category || '-'}</td>
                                <td>${item.name}</td>
                                <td style="text-align: center;">
                                    <span class="result-badge result-${item.result || 'na'}">${item.result || 'N/A'}</span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="notes-section">
                    <div class="notes-title">Additional Notes / หมายเหตุเพิ่มเติม:</div>
                    <div>${record.notes || '-'}</div>
                </div>

                <div class="footer">
                    <div class="sign-box">
                        <p style="margin-bottom: 35px;">Performed By (ผู้ตรวจสอบ)</p>
                        <p>${record.performed_by}</p>
                        <p style="font-size: 9px; color: #666;">Date: ${record.performed_date}</p>
                    </div>
                    <div class="sign-box">
                        <p style="margin-bottom: 35px;">Approved By (ผู้อนุมัติ)</p>
                        <p style="color: #ccc;">__________________________</p>
                        <p style="font-size: 9px; color: #666;">Date: ____/____/____</p>
                    </div>
                </div>

                <div class="no-print" style="position: fixed; bottom: 20px; left: 0; right: 0; text-align: center;">
                    <button onclick="window.print()" style="padding: 10px 40px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">Print to PDF (A4)</button>
                </div>
                <script>
                    // Auto open print dialog
                    window.onload = () => { setTimeout(() => { /* window.print(); */ }, 500); };
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const exportToExcel = () => {
        if (filteredRecords.length === 0) return showToast('ไม่มีข้อมูลที่จะส่งออก', 'warning');
        
        // CSV Header
        let csvContent = "\uFEFF"; // BOM for UTF-8
        csvContent += "Date,Mold Code,Category,Level,Performed By,Status\n";
        
        // Data Rows
        filteredRecords.forEach(r => {
            const row = [
                r.performed_date,
                r.mold_code,
                r.category_name,
                r.pm_level,
                r.performed_by,
                'Completed'
            ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(",");
            csvContent += row + "\n";
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PM_History_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportRecordToExcel = (record) => {
        const data = Array.isArray(record.checklist_data) ? record.checklist_data : [];
        let csvContent = "\uFEFF";
        csvContent += `PM Check Sheet: ${record.mold_code}\n`;
        csvContent += `Category: ${record.category_name}, Level: ${record.pm_level}\n`;
        csvContent += `Performed By: ${record.performed_by}, Date: ${record.performed_date}\n\n`;
        csvContent += "No.,Category,Inspection Item,Result\n";
        
        data.forEach((item, idx) => {
            csvContent += `${idx + 1},"${item.category || ''}","${item.name}","${item.result || 'N/A'}"\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `PM_Record_${record.mold_code}_${record.performed_date}.csv`);
        link.click();
    };

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
            h('div', null,
                h('h2', { className: 'text-lg font-semibold' }, 'รายการ PM (Summary)'),
                h('p', { className: 'text-sm text-surface-400' }, 'ประวัติการตรวจสอบแม่พิมพ์ทั้งหมด')
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
                            h('th', null, 'สถานะ'),
                            h('th', { className: 'text-right' }, 'Action')
                        )
                    ),
                    h('tbody', null,
                        loading
                            ? h('tr', null, h('td', { colSpan: 7, className: 'text-center py-10' }, h('div', { className: 'loading-spinner mx-auto' })))
                            : filteredRecords.length === 0
                                ? h('tr', null, h('td', { colSpan: 7, className: 'text-center py-10 text-surface-500' }, 'ไม่พบข้อมูลรายการ PM'))
                                : filteredRecords.map((r, i) => {
                                    const typeInfo = getTypeInfo(r.pm_level);
                                    const data = Array.isArray(r.checklist_data) ? r.checklist_data : [];
                                    const counts = {
                                        pass: data.filter(d => d.result === 'pass').length,
                                        fail: data.filter(d => d.result === 'fail').length,
                                        na:   data.filter(d => d.result === 'na').length
                                    };

                                    return h('tr', { 
                                        key: r.id, 
                                        className: 'animate-slide-up cursor-pointer hover:bg-primary-500/5 transition-colors', 
                                        style: { animationDelay: (i * 30) + 'ms' },
                                        onClick: () => setSelectedRecord(r)
                                    },
                                        h('td', null, h('span', { className: 'text-xs' }, r.performed_date || '-')),
                                        h('td', null, h('span', { className: 'font-bold text-primary-400' }, r.mold_code)),
                                        h('td', null, 
                                            h('div', null,
                                                h('p', { className: 'text-[10px] text-surface-400' }, r.category_name || '-'),
                                                h('span', { className: 'badge badge-primary text-[10px] mt-1' }, typeInfo.label)
                                            )
                                        ),
                                        h('td', null, h('span', { className: 'text-xs' }, r.template_name || '-')),
                                        h('td', null, 
                                            h('div', { className: 'flex gap-1' },
                                                h('span', { className: 'text-emerald-400 font-bold' }, counts.pass),
                                                h('span', { className: 'text-surface-600' }, '/'),
                                                h('span', { className: 'text-red-400 font-bold' }, counts.fail),
                                                h('span', { className: 'text-surface-600' }, '/'),
                                                h('span', { className: 'text-surface-400 font-bold' }, counts.na)
                                            )
                                        ),
                                        h('td', null, h('span', { className: 'text-xs' }, r.performed_by)),
                                        h('td', null, 
                                            h('span', { className: 'badge badge-success' }, 'เสร็จสิ้น')
                                        ),
                                        h('td', { className: 'text-right' },
                                            h('div', { className: 'flex justify-end gap-1', onClick: e => e.stopPropagation() },
                                                h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-primary-400 hover:bg-primary-500/10',
                                                    title: 'View Details',
                                                    onClick: () => setSelectedRecord(r)
                                                }, h('i', { className: 'fa-solid fa-eye' })),
                                                h('button', { 
                                                    className: 'btn btn-ghost btn-xs text-surface-400 hover:bg-white/10',
                                                    title: 'Print Check Sheet',
                                                    onClick: () => exportCheckSheet(r)
                                                }, h('i', { className: 'fa-solid fa-print' }))
                                            )
                                        )
                                    );
                                })
                    )
                )
            )
        ),

        // Record Details Modal
        selectedRecord && h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in' },
            h('div', { className: 'card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10' },
                // Modal Header
                h('div', { className: 'p-6 border-b border-white/5 flex justify-between items-center bg-surface-800' },
                    h('div', null,
                        h('h3', { className: 'text-lg font-bold text-white' }, 'รายละเอียดการตรวจสอบ (PM Details)'),
                        h('p', { className: 'text-xs text-surface-400' }, `ID: ${selectedRecord.id.toString().slice(-8).toUpperCase()}`)
                    ),
                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setSelectedRecord(null) }, h('i', { className: 'fa-solid fa-times' }))
                ),
                
                // Modal Content
                h('div', { className: 'flex-1 overflow-y-auto p-6 space-y-6' },
                    // Summary Info
                    h('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Mold Code'),
                            h('p', { className: 'text-sm font-bold text-primary-400' }, selectedRecord.mold_code)
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
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Level'),
                            h('span', { className: 'badge badge-primary text-[10px]' }, getTypeInfo(selectedRecord.pm_level).label)
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
                                        h('td', { className: 'p-3 text-surface-400' }, item.category || '-'),
                                        h('td', { className: 'p-3 text-white' }, item.name),
                                        h('td', { className: 'p-3 text-center' }, 
                                            h('span', { className: `font-bold uppercase text-[10px] ${item.result === 'pass' ? 'text-emerald-400' : item.result === 'fail' ? 'text-red-400' : 'text-surface-600'}` }, item.result || 'N/A')
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

                // Modal Footer (Actions)
                h('div', { className: 'p-6 border-t border-white/5 bg-surface-800 flex flex-wrap gap-3 justify-end' },
                    h('button', { 
                        className: 'btn btn-secondary',
                        onClick: () => exportCheckSheet(selectedRecord)
                    }, h('i', { className: 'fa-solid fa-eye mr-2' }), 'ดูเป็น PDF'),
                    h('button', { 
                        className: 'btn btn-primary',
                        onClick: () => exportCheckSheet(selectedRecord)
                    }, h('i', { className: 'fa-solid fa-file-pdf mr-2' }), 'Export PDF'),
                    h('button', { 
                        className: 'btn bg-emerald-600 hover:bg-emerald-500 text-white',
                        onClick: () => exportRecordToExcel(selectedRecord)
                    }, h('i', { className: 'fa-solid fa-file-excel mr-2' }), 'Download Excel')
                )
            )
        )
    );
}

window.PMHistoryPage = PMHistoryPage;
